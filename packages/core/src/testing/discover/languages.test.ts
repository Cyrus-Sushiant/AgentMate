import { describe, expect, it } from 'vitest';
import type { DiscoveredTest } from '../types.js';
import {
  discoverCsharpTests,
  discoverGoTests,
  discoverJvmTests,
  discoverPhpTests,
  discoverPythonTests,
  discoverRubyTests,
  discoverRustTests,
} from './languages.js';

const show = (found: DiscoveredTest[]) =>
  found.map(
    (test) =>
      `${test.kind} ${test.line} ${test.path.join(' > ')}${test.selector ? ` [${test.selector}]` : ''}`,
  );

describe('discoverPythonTests', () => {
  it('finds test functions and methods of test classes', () => {
    const source = [
      'import pytest',
      '',
      'def helper():',
      '    pass',
      '',
      'def test_adds():',
      '    assert 1 + 1 == 2',
      '',
      '@pytest.mark.parametrize("n", [1, 2])',
      'async def test_async(n):',
      '    pass',
      '',
      'class TestUser:',
      '    def test_name(self):',
      '        pass',
      '',
      '    def not_a_test(self):',
      '        pass',
      '',
      '    class TestNested:',
      '        def test_deep(self):',
      '            pass',
      '',
      'class Helper:',
      '    def test_ignored(self):',
      '        pass',
      '',
      'class LoginCase(unittest.TestCase):',
      '    def test_login(self):',
      '        pass',
    ].join('\n');
    expect(show(discoverPythonTests(source))).toEqual([
      'test 6 test_adds',
      'test 10 test_async',
      'suite 13 TestUser',
      'test 14 TestUser > test_name',
      'suite 20 TestUser > TestNested',
      'test 21 TestUser > TestNested > test_deep',
      'suite 28 LoginCase',
      'test 29 LoginCase > test_login',
    ]);
  });
});

describe('discoverGoTests', () => {
  it('finds top level Test functions only', () => {
    const source = [
      'package calc',
      '',
      'import "testing"',
      '',
      'func TestAdd(t *testing.T) {',
      '\tt.Run("zero", func(t *testing.T) {})',
      '}',
      '',
      'func TestSub(tt *testing.T) {}',
      'func BenchmarkAdd(b *testing.B) {}',
      'func helper(t *testing.T) {}',
      'func Testlowercase(t *testing.T) {}',
      '// func TestCommented(t *testing.T) {}',
    ].join('\n');
    expect(show(discoverGoTests(source))).toEqual(['test 5 TestAdd', 'test 9 TestSub']);
  });
});

describe('discoverRustTests', () => {
  it('builds module paths from the file and inline modules', () => {
    const source = [
      'pub fn add(a: i32, b: i32) -> i32 { a + b }',
      '',
      '#[cfg(test)]',
      'mod tests {',
      '    use super::*;',
      '',
      '    #[test]',
      '    fn adds() {',
      '        assert_eq!(add(1, 2), 3);',
      '    }',
      '',
      '    mod inner {',
      '        #[tokio::test]',
      '        async fn async_case() {}',
      '    }',
      '',
      '    #[test]',
      '    #[should_panic]',
      '    fn panics() { let s = "}"; }',
      '}',
      '',
      '#[test]',
      'fn top_level() {}',
      '',
      'fn not_a_test() {}',
    ].join('\n');
    expect(show(discoverRustTests(source, 'src/math/ops.rs'))).toEqual([
      'test 8 math > ops > tests > adds [math::ops::tests::adds]',
      'test 14 math > ops > tests > inner > async_case [math::ops::tests::inner::async_case]',
      'test 19 math > ops > tests > panics [math::ops::tests::panics]',
      'test 23 math > ops > top_level [math::ops::top_level]',
    ]);
  });

  it('roots crate entry files and integration tests at the crate', () => {
    const source = '#[test]\nfn works() {}\n';
    expect(show(discoverRustTests(source, 'src/lib.rs'))).toEqual(['test 2 works [works]']);
    expect(show(discoverRustTests(source, 'src/parser/mod.rs'))).toEqual([
      'test 2 parser > works [parser::works]',
    ]);
    expect(show(discoverRustTests(source, 'tests/api.rs'))).toEqual(['test 2 works [works]']);
  });
});

describe('discoverCsharpTests', () => {
  it('finds xUnit, NUnit and MSTest methods with fully qualified names', () => {
    const source = [
      'using Xunit;',
      '',
      'namespace Shop.Tests;',
      '',
      'public class CartTests',
      '{',
      '    [Fact]',
      '    public void Adds_item()',
      '    {',
      '    }',
      '',
      '    [Theory]',
      '    [InlineData(1)]',
      '    public async Task Totals(int count) { }',
      '',
      '    [Fact(Skip = "later")] public void Skipped() { }',
      '',
      '    public void Helper() { }',
      '',
      '    public class Nested',
      '    {',
      '        [Test, Category("slow")]',
      '        public void Deep() { }',
      '    }',
      '}',
    ].join('\n');
    expect(show(discoverCsharpTests(source))).toEqual([
      'suite 5 CartTests',
      'test 8 CartTests > Adds_item [Shop.Tests.CartTests.Adds_item]',
      'test 14 CartTests > Totals [Shop.Tests.CartTests.Totals]',
      'test 16 CartTests > Skipped [Shop.Tests.CartTests.Skipped]',
      'suite 20 CartTests > Nested',
      'test 23 CartTests > Nested > Deep [Shop.Tests.CartTests+Nested.Deep]',
    ]);
  });

  it('handles block scoped namespaces', () => {
    const source = [
      'namespace A.B',
      '{',
      '    [TestClass]',
      '    public class Math',
      '    {',
      '        [TestMethod]',
      '        public void One() { }',
      '    }',
      '}',
    ].join('\n');
    expect(show(discoverCsharpTests(source))).toEqual([
      'suite 4 Math',
      'test 7 Math > One [A.B.Math.One]',
    ]);
  });
});

describe('discoverPhpTests', () => {
  it('finds test methods, @test docblocks and Test attributes', () => {
    const source = [
      '<?php',
      'namespace App\\Tests;',
      '',
      'final class UserTest extends TestCase',
      '{',
      '    public function testCreates(): void {}',
      '',
      '    /** @test */',
      '    public function it_validates(): void {}',
      '',
      '    #[Test]',
      '    public function renames(): void {}',
      '',
      '    private function helper(): void {}',
      '}',
    ].join('\n');
    expect(show(discoverPhpTests(source))).toEqual([
      'suite 4 UserTest',
      'test 6 UserTest > testCreates [App\\Tests\\UserTest::testCreates]',
      'test 9 UserTest > it_validates [App\\Tests\\UserTest::it_validates]',
      'test 12 UserTest > renames [App\\Tests\\UserTest::renames]',
    ]);
  });
});

describe('discoverRubyTests', () => {
  it('nests examples by indentation', () => {
    const source = [
      "require 'rails_helper'",
      '',
      'RSpec.describe User, type: :model do',
      "  describe '#name' do",
      "    it 'joins first and last' do",
      '    end',
      '',
      '    context "without a last name" do',
      "      it('uses the first') { expect(1).to eq 1 }",
      '    end',
      '  end',
      '',
      "  specify 'is valid' do",
      '  end',
      'end',
    ].join('\n');
    expect(show(discoverRubyTests(source))).toEqual([
      'suite 3 User',
      'suite 4 User > #name',
      'test 5 User > #name > joins first and last',
      'suite 8 User > #name > without a last name',
      'test 9 User > #name > without a last name > uses the first',
      'test 13 User > is valid',
    ]);
  });
});

describe('discoverJvmTests', () => {
  it('finds JUnit tests in Java', () => {
    const source = [
      'package com.acme.cart;',
      '',
      'import org.junit.jupiter.api.Test;',
      '',
      'class CartTest {',
      '    @Test',
      '    void addsItem() {}',
      '',
      '    @ParameterizedTest',
      '    @ValueSource(ints = {1, 2})',
      '    public void totals(int n) {}',
      '',
      '    void helper() {}',
      '}',
    ].join('\n');
    expect(show(discoverJvmTests(source))).toEqual([
      'suite 5 CartTest',
      'test 7 CartTest > addsItem [com.acme.cart.CartTest.addsItem]',
      'test 11 CartTest > totals [com.acme.cart.CartTest.totals]',
    ]);
  });

  it('finds Kotlin tests with backticked names', () => {
    const source = [
      'package com.acme',
      '',
      'class PriceTest {',
      '    @Test',
      '    fun `applies a discount`() {}',
      '',
      '    @Test fun rounds() {}',
      '}',
    ].join('\n');
    expect(show(discoverJvmTests(source))).toEqual([
      'suite 3 PriceTest',
      'test 5 PriceTest > applies a discount [com.acme.PriceTest.applies a discount]',
      'test 7 PriceTest > rounds [com.acme.PriceTest.rounds]',
    ]);
  });
});
