import { getMetricsApi } from '../api/GitHubApi'; 
import axios from 'axios';

export class Tenant {
    public scopeType: 'organization' | 'enterprise';
    public scopeName: string;
    public token: string;
    public isActive: boolean;
    public team: string; // Add team property
    public directChildTeams: string[] = [];

    constructor(scopeType: 'organization' | 'enterprise', scopeName: string, token: string, team: string = '', isActive: boolean = true) {
        this.scopeType = scopeType;
        this.scopeName = scopeName;
        this.token = token;
        this.team = team; // Assign team property
        this.isActive = isActive;

        // Validate tenant using GitHub API
       // this.validateTenant();
    }

    public async validateTenant(): Promise<boolean> {
        try {
            await getMetricsApi(this.scopeType, this.scopeName, this.token);
            return true;
        } catch (error) {
            throw new Error('Invalid tenant information: scopeType, scopeName, or token is incorrect');
            return false;
        }
    }

    public async fetchDirectChildTeams(): Promise<string[]> {
        try {
            const apiUrl = this.scopeType === 'organization'
                ? `https://api.github.com/orgs/${this.scopeName}/teams`
                : `https://api.github.com/enterprises/${this.scopeName}/teams`;

            const response = await axios.get(apiUrl, {
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${this.token}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });

            this.directChildTeams = response.data.map((team: any) => team.slug);
            return this.directChildTeams;
        } catch (error) {
            console.error(`Error fetching direct child teams from GitHub API for ${this.scopeName}:`, error);
            return [];
        }
    }
}
