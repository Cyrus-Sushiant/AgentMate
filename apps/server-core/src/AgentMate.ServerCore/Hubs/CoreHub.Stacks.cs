using AgentMate.ServerCore.Contracts;
using AgentMate.ServerCore.Security;
using AgentMate.ServerCore.Stacks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AgentMate.ServerCore.Hubs;

/// <summary>
/// Compose stacks (E07), the Apps of a server. Every role reads them; Operators create apps,
/// acknowledge findings, deploy, roll back, run the lifecycle and delete; deleting an app with its
/// volumes (its data) is for Admins. Files arrive over REST (StackEndpoints). Every change and
/// every refusal lands in the audit trail; env values never leave the core.
/// </summary>
internal sealed partial class CoreHub
{
    private StackCaller StackCaller => new(UserId, Caller.UserName, DeviceId, PeerCredentials.UidOf(Context.GetHttpContext()));

    [Authorize(Policy = CorePolicies.Viewer)]
    public Task<StackInfo[]> ListStacks() => StackCallAsync(() => stacks.ListAsync(Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Viewer)]
    public Task<StackDetails> GetStack(Guid stackId) => StackCallAsync(() => stacks.GetAsync(stackId, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Viewer)]
    public Task<StackRevisionFiles> GetStackRevisionFiles(StackRevisionRef revision) =>
        StackCallAsync(() => stacks.FilesAsync(Required(revision).StackId, revision.Revision, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<StackInfo> CreateStack(CreateStackRequest request) =>
        StackCallAsync(() => stacks.CreateAsync(request, StackCaller, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<StackRevisionInfo> AcknowledgeStackRisks(AcknowledgeStackRisksRequest request) =>
        StackCallAsync(() => stacks.AcknowledgeAsync(request, StackCaller, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<JobInfo> DeployStack(StackRevisionRef revision) =>
        StackCallAsync(() => stacks.DeployAsync(Required(revision).StackId, revision.Revision, StackCaller, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<JobInfo> RollbackStack(StackRevisionRef revision) =>
        StackCallAsync(() => stacks.RollbackAsync(Required(revision).StackId, revision.Revision, StackCaller, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<JobInfo> RunStackAction(StackActionRequest request) =>
        StackCallAsync(() => stacks.RunActionAsync(
            request?.StackId ?? throw new HubException("Name the app."),
            request.Action,
            StackCaller,
            Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Operator)]
    public Task<JobInfo> DeleteStack(Guid stackId) =>
        StackCallAsync(() => stacks.DeleteAsync(stackId, removeVolumes: false, StackCaller, Context.ConnectionAborted));

    [Authorize(Policy = CorePolicies.Admin)]
    public Task<JobInfo> DeleteStackWithVolumes(Guid stackId) =>
        StackCallAsync(() => stacks.DeleteAsync(stackId, removeVolumes: true, StackCaller, Context.ConnectionAborted));

    private static StackRevisionRef Required(StackRevisionRef? revision) =>
        revision ?? throw new HubException("Name the app and the revision.");

    private static async Task<T> StackCallAsync<T>(Func<Task<T>> call)
    {
        try
        {
            return await call();
        }
        catch (StackRefusedException refused)
        {
            throw new HubException(refused.Message);
        }
    }
}
