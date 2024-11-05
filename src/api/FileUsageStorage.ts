import * as fs from 'fs';
import path from 'path';
import { Metrics } from '../model/Metrics';
import { getMetricsApi } from './/GitHubApi';
import { IUsageStorage } from './IUsageStorage';

import { Tenant } from '../model/Tenant';
import { dir } from 'console';

export class FileUsageStorage implements IUsageStorage {
    

    //private filePath: string = '';
    private scopeName: string = '';
    private scopeType: string = '';
    private token: string = '';
    private team?: string;
    private directChildTeams: string[] = [];

    private dirName: string = '../../data';

    // full path of the file named by ScopeName_metrics.json and the directory is ../data
    private ScopeFilePath: string = ''

    // private ScopeName: string = config.scope.name;
    // private dirName: string = '../../data';
    // private ScopeFileName: string = `${config.scope.scopeType}_${config.scope.name}_metrics.json`;
    // private ScopeFilePath: string = path.join(__dirname, this.dirName, this.ScopeFileName);

    constructor(tenant: Tenant) {
        this.initializeScope(tenant);
        this.initializeFilePath(tenant);
    }
    


    public initializeScope(tenant: Tenant) {
        // Initialize scope based on tenant information
        this.scopeName = tenant.scopeName;
        this.scopeType = tenant.scopeType;
        this.token = tenant.token;
        this.team=tenant.team;
        this.directChildTeams = tenant.directChildTeams || [];
    }

    private initializeFilePath(tenant: Tenant) {

        
        // if team is not provided, the file name is scopeType_scopeName_metrics.json
        // if team is provided, the file name is scopeType_scopeName_team_team_metrics.json
        //const ScopeFileName = `${tenant.scopeType}_${tenant.scopeName}_metrics.json`;
        let ScopeFileName = '';
        //console.log('team in path:', tenant.team);

        if (tenant.team) {
            ScopeFileName = `${tenant.scopeType}_${tenant.scopeName}_team_${tenant.team}_metrics.json`;
        } else {
            ScopeFileName = `${tenant.scopeType}_${tenant.scopeName}_metrics.json`;
        }
        const resolvedPath = path.resolve(__dirname, this.dirName, ScopeFileName);
        this.ScopeFilePath = path.join(__dirname, this.dirName, ScopeFileName);
        if (!resolvedPath.startsWith(path.resolve(__dirname, this.dirName))) {
              throw new Error('Invalid file path');
          }
        this.ScopeFilePath = resolvedPath;

        try{
        
            // console.log('ScopeFilePath:', this.ScopeFilePath);
             // to check if the ../data folder exists, if not, create it
             if (!fs.existsSync(path.join(__dirname, this.dirName))) {
                 fs.mkdirSync(path.join(__dirname, this.dirName));
             }
             // Create a file named by ScopeName_metrics.json within ../data folder if it does not exist
             if (!fs.existsSync(this.ScopeFilePath)) {
                 fs.writeFileSync(this.ScopeFilePath, '[]');
             }
         }
         catch (error) {
             console.error('Error in FileUsageStorage constructor:', error);
         }
        
    }

    private getCurrentTimeFormatted(): string {
        const now = new Date();
        return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    }

    private getRandomTwoDigits(): string {
        return Math.floor(Math.random() * 90 + 10).toString(); // Random number between 10 and 99
    }

    private generateTimerFileFullName(): string {
        // if the team is not provided, the file name is scopeType_scopeName_metrics.json
        // if the team is provided, the file name is scopeType_scopeName_team_team_metrics.json
        if (this.team) {
            return path.join(__dirname, this.dirName, `${this.scopeType}_${this.scopeName}_team_${this.team}_${this.getCurrentTimeFormatted()}_${this.getRandomTwoDigits()}_metrics.json`);
        }
        else
        {
            return path.join(__dirname, this.dirName, `${this.scopeType}_${this.scopeName}_${this.getCurrentTimeFormatted()}_${this.getRandomTwoDigits()}_metrics.json`);
        }
        //return path.join(__dirname, this.dirName, `${this.scopeType}_${this.scopeName}_${this.getCurrentTimeFormatted()}_${this.getRandomTwoDigits()}_metrics.json`);
    }

    public async readUsageData(): Promise<Metrics[]> {
        try {
            const data = fs.readFileSync(this.ScopeFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading usage data from file:', error);
            return [];
        }
    }
/* 
    // This function is to save the fetched data to a file named by timer_filePath
    public async saveUsageData(): Promise<boolean> {
        try {
          const metrics = await getMetricsApi(this.scopeType, this.scopeName, this.token);
          //console.log('Fetched metrics:', metrics);
    
          if (!Array.isArray(metrics)) {
            throw new Error('Result is not an array.');
          }
    
          const dataToWrite = JSON.stringify(metrics, null, 2);
          //console.log('Data to write:', dataToWrite);
          
            const fileFullName = this.generateTimerFileFullName();
            // write the fetch data to file named by timer_filePath, which is a new file, and it is latest data.
            fs.writeFileSync(fileFullName, dataToWrite);
            // compare and update the content of the file named by getScopeFileName,which is the ScopeUsage file
            console.log('Metrics saved successfully to file:', fileFullName);
            await this.compareAndUpdateMetrics(metrics);
            return true;
        } catch (error) {
          console.error('Error saving metrics:', error);
            return false;
        }
      } */

    public async saveUsageData(metrics?: Metrics[]): Promise<boolean> {
        try {
           /*  if (!metrics) {
                metrics = await getMetricsApi(this.scopeType, this.scopeName, this.token,this.team);
            } */
            if (!Array.isArray(metrics)) {
                throw new Error('Result is not an array.');
            }
    
            const dataToWrite = JSON.stringify(metrics, null, 2);
            const fileFullName = this.generateTimerFileFullName();
            fs.writeFileSync(fileFullName, dataToWrite);
            console.log('Metrics saved successfully to file:', fileFullName);
            await this.compareAndUpdateMetrics(metrics);

            // Save usage data for direct-child-teams
            for (const team of this.directChildTeams) {
                const teamMetrics = await getMetricsApi(this.scopeType, this.scopeName, this.token, team);
                await this.saveUsageData(teamMetrics);
            }

            return true;
        } catch (error) {
            console.error('Error saving metrics:', error);
            return false;
        }
    }
        
    private async compareAndUpdateMetrics(latestUsage?: Metrics[], ScopeUsage?: Metrics[]): Promise<void> {
            try {
            if (!latestUsage) { 
                console.log("No latest usage data provided. Will get it from API.");
                latestUsage = await getMetricsApi(this.scopeType, this.scopeName, this.token, this.team);
            }
            if (!ScopeUsage) {
            // console.log("No existing data provided. Will get it from file.");
                ScopeUsage = await this.readUsageData();
            }

            // Validate data
            if (!Array.isArray(latestUsage) || !Array.isArray(ScopeUsage)) {
                throw new Error("Invalid data format. Both latestUsage and ScopeUsage should be arrays.");
            }

            // Initialize lists to track days of updated and added metrics
            const updatedDays: string[] = [];
            const addedDays: string[] = [];

            if (latestUsage.length > 0) {
                latestUsage.forEach(latestMetric => {
                    const existingMetricIndex = ScopeUsage!.findIndex(orgMetric => orgMetric.day === latestMetric.day);

                    if (existingMetricIndex !== -1) {
                        // Update existing metric
                        ScopeUsage![existingMetricIndex] = latestMetric;
                        updatedDays.push(latestMetric.day);
                    } else {
                        // Add new metric
                        ScopeUsage!.push(latestMetric);
                        addedDays.push(latestMetric.day);
                    }
                });

                // Save to existing ScopeUsage file only when there are some changes
                if (updatedDays.length > 0 || addedDays.length > 0) {
                    fs.writeFileSync(this.ScopeFilePath, JSON.stringify(ScopeUsage, null, 2));
                // console.log(`Days updated: ${updatedDays.join(', ')}, Days added: ${addedDays.join(', ')}`);

                    // Send notification
                    this.sendNotification(updatedDays, addedDays);
                }
            } else {
                console.log("No latest usage data provided.");
            }
        } catch (error) {
            console.error("Error in compareAndUpdateMetrics:", error);
        }
}

// Example notification method
private sendNotification(updatedDays: string[], addedDays: string[]): void {
    // Implement your notification logic here
    console.log(`Notification sent for updated days: ${updatedDays.join(', ')}, added days: ${addedDays.join(', ')}`);
}

async queryUsageData(since?: string, until?: string, page: number = 1, per_page: number = 28): Promise<Metrics[]> {
    try {
        //console.log('Querying usage data from file...， file name is ',this.ScopeFilePath);
        const data = fs.readFileSync(this.ScopeFilePath, 'utf-8');
        let metrics: Metrics[] = JSON.parse(data);

        if (since) {
            metrics = metrics.filter(metric => new Date(metric.day) >= new Date(since));
        }

        if (until) {
            metrics = metrics.filter(metric => new Date(metric.day) <= new Date(until));
        }

        const start = (page - 1) * per_page;
        const end = start + per_page;
        return metrics.slice(start, end);
    } catch (error) {
        console.error('Error querying usage data from file:', error);
        return [];
    }
}

}
