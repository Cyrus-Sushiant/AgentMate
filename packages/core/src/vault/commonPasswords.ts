/**
 * The passwords that top every breach list, lowercased. Anything here (or one of these with
 * a few digits or symbols tacked on) gets the lowest score no matter how the math works out.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  `123456 123456789 12345678 12345 1234567 1234567890 123123 111111 000000 654321 666666 121212
  112233 123321 7777777 987654321 1q2w3e4r 1qaz2wsx 1q2w3e4r5t qwerty qwertyuiop qwerty123
  asdfgh asdfghjkl zxcvbnm azerty password passw0rd p@ssw0rd password1 password123 pass pass123
  admin administrator root toor guest user test test123 demo changeme default welcome welcome1
  letmein iloveyou loveme lovely love trustno1 monkey dragon master shadow sunshine princess
  football baseball soccer hockey basketball superman batman spiderman starwars pokemon
  michael jennifer jordan jessica ashley daniel charlie thomas hunter ranger buster tigger
  harley andrew joshua matthew robert anthony william george summer winter autumn spring
  flower cookie cheese chocolate banana orange apple pepper ginger freedom whatever secret
  mustang ferrari corvette killer hello hello123 hellokitty computer internet google facebook
  instagram linkedin twitter youtube samsung iphone android microsoft windows linux ubuntu
  login access letmein1 abc123 abcd1234 abcdef abcdefg aa123456 a123456 qazwsx qweasd
  zaq12wsx 1234qwer qwer1234 q1w2e3r4 passport maggie ginger1 silver golden diamond
  purple yellow orange1 blue green red black white hannah amanda nicole jasmine
  matrix mercedes nirvana metallica slipknot liverpool chelsea arsenal barcelona realmadrid
  cowboys eagles yankees lakers raiders steelers packers dolphins donald trump biden
  qwerty1 111222 aaaaaa 11111111 22222222 88888888 99999999 00000000 696969 696969a
  zxcvbn asd123 qwe123 zxc123 iloveu iloveyou1 myspace friends family bailey sophie
  jesus christ angel angels heaven blessed faith grace god lucky lucky7 money cash
  business company office work school student teacher doctor nurse 1234abcd abc12345`
    .split(/\s+/)
    .filter(Boolean),
);
