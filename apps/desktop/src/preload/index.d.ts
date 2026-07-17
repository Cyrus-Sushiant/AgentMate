import type { AgentmatApi } from './index';

declare global {
  interface Window {
    agentmat: AgentmatApi;
  }
}
