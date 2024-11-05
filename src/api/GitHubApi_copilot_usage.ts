import axios from 'axios';
import { Metrics } from '../model/Metrics';
import { Tenant } from '../model/Tenant';

export class GitHubApi {
  private tenant: Tenant;
  private team?: string;
  private directChildTeams: string[] = [];

  constructor(tenant: Tenant) {
    if (!tenant.isActive) {
      throw new Error("Inactive tenant cannot be used for API operations.");
    }
    this.tenant = tenant;
    this.team = tenant.team;
  }

  private getApiUrl(): string {
    if (this.team && this.team.trim() !== '') {
      return this.tenant.scopeType === 'organization'
        ? `https://api.github.com/orgs/${this.tenant.scopeName}/team/${this.team}`
        : `https://api.github.com/enterprises/${this.tenant.scopeName}/team/${this.team}`;
    } else {
      return this.tenant.scopeType === 'organization'
        ? `https://api.github.com/orgs/${this.tenant.scopeName}`
        : `https://api.github.com/enterprises/${this.tenant.scopeName}`;
    }
  }

  async getMetricsApi(): Promise<Metrics[]> {
    console.log(`get metrics api called for ${this.tenant.scopeName} at `, new Date());
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
      if (response.status !== 200) {
        throw new Error(`Failed to get metrics from GitHub API for ${this.tenant.scopeName}`);
      }

      const metrics = response.data.map((item: any) => new Metrics(item));

      if (this.directChildTeams.length > 0) {
        for (const team of this.directChildTeams) {
          const teamMetrics = await this.getTeamMetricsApi(team);
          metrics.push(...teamMetrics);
        }
      }

      return metrics;
    } catch (error) {
      console.error(`Error fetching metrics from GitHub API for ${this.tenant.scopeName}:`);
      return [];
    }
  }

  async getDirectChildTeams(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.getApiUrl()}/teams`, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.tenant.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      this.directChildTeams = response.data.map((team: any) => team.slug);
      return this.directChildTeams;
    } catch (error) {
      console.error(`Error fetching direct child teams from GitHub API for ${this.tenant.scopeName}:`, error);
      return [];
    }
  }

  async getTeamMetricsApi(team: string): Promise<Metrics[]> {
    if (team && team.trim() !== '') {
      const response = await axios.get(
        `${this.getApiUrl()}/team/${team}/copilot/usage`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${this.tenant.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
      return response.data.map((item: any) => new Metrics(item));
    }

    return [];
  }
}
