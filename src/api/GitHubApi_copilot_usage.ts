import axios from 'axios';
import { CopilotUsage } from '../model/Copilot_Usage';
import { Tenant } from '../model/Tenant';

export class GitHubApiCopilotUsage {
  private tenant: Tenant;
  private team?: string;

  constructor(tenant: Tenant) {
    if (!tenant.isActive) {
      throw new Error("Inactive tenant cannot be used for API operations.");
    }
    this.tenant = tenant;
    this.team = tenant.team;
  }

  private getApiUrl(): string {
    // need to checck whehter the tenant's team is set, it is set, then the url should be https://api.github.com/[scoptName]/:org/teams/:team
    if (this.team && this.team.trim() !== '') {
      return this.tenant.scopeType === 'organization'
        ? `https://api.github.com/orgs/${this.tenant.scopeName}/team/${this.team}`
        : `https://api.github.com/enterprises/${this.tenant.scopeName}/team/${this.team}`;
    }
    else {
      return this.tenant.scopeType === 'organization'
        ? `https://api.github.com/orgs/${this.tenant.scopeName}`
        : `https://api.github.com/enterprises/${this.tenant.scopeName}`;
    }

  }

  async getUsageApi(): Promise<CopilotUsage[]> {
    console.log(`get metrics api called for team ${this.tenant.team} of ${this.tenant.scopeName} at `, new Date());
    try {
      const response = await axios.get(
        `${this.getApiUrl()}/copilot/usage`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.tenant.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      //check the response status, it should be 200, if not, throw an error
      if (response.status !== 200) {
        throw new Error(`Failed to get metrics from GitHub API for ${this.tenant.scopeName}`);
      }
      return response.data.map((item: any) => new CopilotUsage(item));
    } catch (error) {
      console.error(`Error fetching usage from GitHub API for ${this.tenant.scopeName}:`);
     // throw error;
      return [];
    }
  }

  async getTeams(): Promise<{ name: string; id: number; slug: string; description: string }[]> {
    const response = await axios.get(`${this.getApiUrl()}/teams`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.tenant.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    //return response.data;
    // update to return only the team values we need
    return response.data.map((team: any) => ({
      name: team.name,
      id: team.id,
      slug: team.slug,
      description: team.description,
    }));

  }

  async getTeamUsageAPI(teamSlug: string): Promise<CopilotUsage[]> {
   // console.log("config.github.team: " + this.team);

    if (teamSlug && teamSlug.trim() !== '') {
      const response = await axios.get(
        `${this.getApiUrl()}/team/${teamSlug}/copilot/usage`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.tenant.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      return response.data.map((item: any) => new CopilotUsage(item));
    }

    return [];
  }
}

