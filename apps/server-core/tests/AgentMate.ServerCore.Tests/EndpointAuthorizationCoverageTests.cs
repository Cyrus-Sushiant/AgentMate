using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace AgentMate.ServerCore.Tests;

/// <summary>
/// The fallback policy denies anything left unmarked, but relying on it hides intent. Every mapped
/// endpoint has to say either "anonymous" or which policy guards it, so a new route cannot ship
/// with an access decision nobody made.
/// </summary>
public sealed class EndpointAuthorizationCoverageTests(CoreFactory factory) : IClassFixture<CoreFactory>
{
    [Fact]
    public void Every_endpoint_declares_its_authorization()
    {
        var endpoints = factory.Services
            .GetRequiredService<EndpointDataSource>()
            .Endpoints
            .OfType<RouteEndpoint>()
            .ToList();

        Assert.NotEmpty(endpoints);
        var undecided = endpoints
            .Where(endpoint =>
                endpoint.Metadata.GetMetadata<IAllowAnonymous>() is null
                && !endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
                    .Any(data => !string.IsNullOrEmpty(data.Policy)))
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .ToList();

        Assert.Empty(undecided);
    }

    [Fact]
    public void Only_health_is_anonymous()
    {
        var anonymous = factory.Services
            .GetRequiredService<EndpointDataSource>()
            .Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .ToList();

        Assert.Equal(["/api/v1/health"], anonymous);
    }
}
