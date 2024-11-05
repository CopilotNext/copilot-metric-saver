import { createConnection, Connection } from 'mysql2/promise';
import { IUsageStorage } from './IUsageStorage';
import { Metrics, BreakdownData } from '../model/Metrics';
import { storage_config } from '../../config';
import { Tenant } from '../model/Tenant';

export class MySQLUsageStorage implements IUsageStorage {
    private dbConnection: Connection | null = null;
    private scope_name: string = '';
    private type: string = '';
    private team?: string= '';
    private directChildTeams: string[] = [];
    private initialized: boolean = false;

    constructor(tenant: Tenant) {
        this.initializeScope(tenant);
        this.initConnection();
        this.initializeDatabase();
    }

    private async initConnection() {
        try {
            this.dbConnection = await createConnection({
                host: storage_config.DB?.HOST,
                user: storage_config.DB?.USER,
                password: storage_config.DB?.PASSWORD,
                database: storage_config.DB?.DATABASE,
                port: storage_config.DB?.PORT,
            });
            console.log('Database connection established successfully in Usage Module.');
            this.initialized= true;
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.initialized = false;
        }
       
    }


    public async initializeScope(tenant: Tenant) {
        try {
            this.scope_name = tenant.scopeName;
            this.type = tenant.scopeType;
            this.team = tenant.team;
            this.directChildTeams = tenant.directChildTeams || [];
            console.log('scope_name in Usage initializeScope:', this.scope_name);
            console.log('team in Usage initializeScope:', this.team);
        } catch (error) {
            console.error('Error initializing Usage scope:', error);
        }
    }

    private async initializeDatabase() {

        await this.ensureInitialized();
        
        const createMetricsTableQuery = `
            CREATE TABLE IF NOT EXISTS Metrics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                day DATE NOT NULL,
                total_suggestions_count INT NOT NULL,
                total_acceptances_count INT NOT NULL,
                total_lines_suggested INT NOT NULL,
                total_lines_accepted INT NOT NULL,
                total_active_users INT NOT NULL,
                total_chat_acceptances INT DEFAULT 0,
                total_chat_turns INT DEFAULT 0,
                total_active_chat_users INT DEFAULT 0,
                type ENUM('organization','enterprise') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                team VARCHAR(255) DEFAULT '',
                UNIQUE KEY unique_day_type_scope_team(day, type, scope_name,team)
            );
        `;

        const createBreakdownDataTableQuery = `
            CREATE TABLE IF NOT EXISTS BreakdownData (
                id INT AUTO_INCREMENT PRIMARY KEY,
                day DATE NOT NULL,
                type ENUM('organization','enterprise') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                team VARCHAR(255) DEFAULT '',
                language VARCHAR(255) NOT NULL,
                editor VARCHAR(255) NOT NULL,
                suggestions_count INT NOT NULL,
                acceptances_count INT NOT NULL,
                lines_suggested INT NOT NULL,
                lines_accepted INT NOT NULL,
                active_users INT NOT NULL,
                UNIQUE KEY unique_day_scope_team_lang_ide (day, type, scope_name(50), team(50), language(50), editor(50))
                );
        `;

        await this.dbConnection!.execute(createMetricsTableQuery);
        await this.dbConnection!.execute(createBreakdownDataTableQuery);
        console.log('Database Usage tables initialized.');
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            console.log('Re-initializing connection in Usage Module...');
            await this.initConnection();
        }
    }

    public async saveUsageData(metrics: Metrics[]): Promise<boolean> {
        await this.ensureInitialized();
        console.log('team in saveUsageData:', this.team);
        try {
            const metricsQuery = `
                INSERT INTO Metrics (day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users, type, scope_name, team)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                AS new
                ON DUPLICATE KEY UPDATE
                    total_suggestions_count = new.total_suggestions_count,
                    total_acceptances_count = new.total_acceptances_count,
                    total_lines_suggested = new.total_lines_suggested,
                    total_lines_accepted = new.total_lines_accepted,
                    total_active_users = new.total_active_users,
                    total_chat_acceptances = new.total_chat_acceptances,
                    total_chat_turns = new.total_chat_turns,
                    total_active_chat_users = new.total_active_chat_users,
                    type = new.type,
                    scope_name = new.scope_name,
                    team = new.team;
            `;

            const breakdownQuery = `
                INSERT INTO BreakdownData (day, type, scope_name, team, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                AS new
                ON DUPLICATE KEY UPDATE
                    suggestions_count = new.suggestions_count,
                    acceptances_count = new.acceptances_count,
                    lines_suggested = new.lines_suggested,
                    lines_accepted = new.lines_accepted,
                    active_users = new.active_users,
                    type = new.type,
                    scope_name = new.scope_name,
                    team = new.team,
                    language = new.language,
                    editor = new.editor;
            `;

            for (const metric of metrics) {
                await this.dbConnection!.execute(metricsQuery, [
                    metric.day, metric.total_suggestions_count, metric.total_acceptances_count, metric.total_lines_suggested, metric.total_lines_accepted, metric.total_active_users, metric.total_chat_acceptances, metric.total_chat_turns, metric.total_active_chat_users, this.type, this.scope_name,this.team
                ]);

                for (const breakdown of metric.breakdown) {
                    await this.dbConnection!.execute(breakdownQuery, [
                        metric.day, this.type, this.scope_name,this.team, breakdown.language, breakdown.editor, breakdown.suggestions_count, breakdown.acceptances_count, breakdown.lines_suggested, breakdown.lines_accepted, breakdown.active_users
                    ]);
                }
            }

            // Save usage data for direct-child-teams
            for (const team of this.directChildTeams) {
                const teamMetrics = await getMetricsApi(this.type, this.scope_name, this.token, team);
                await this.saveUsageData(teamMetrics);
            }

            return true;
        } catch (error) {
            console.error('Error saving usage data to MySQL:', error);
            return false;
        }
    }

    public async readUsageData(): Promise<Metrics[]> {
        await this.ensureInitialized();
        console.log('team in readUsageData:', this.team);
        try {

            if (this.team === null || this.team === '') {
                this.team = '';
            }
            const metricsQuery = `
                SELECT day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users 
                FROM Metrics 
                WHERE type = ? AND scope_name = ? AND team = ?`;
            const breakdownQuery = `
                SELECT day, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users 
                FROM BreakdownData 
                WHERE type = ? AND scope_name = ? AND team = ?`;

            const [metricsRows] = await this.dbConnection!.execute(metricsQuery, [this.type, this.scope_name,this.team]);
            const [breakdownRows] = await this.dbConnection!.execute(breakdownQuery, [this.type, this.scope_name,this.team]);

            const breakdownMap = new Map<string, BreakdownData[]>();
            for (const row of breakdownRows as any[]) {
                const key = `${row.day}`;
                if (!breakdownMap.has(key)) {
                    breakdownMap.set(key, []);
                }
                breakdownMap.get(key)!.push(new BreakdownData(row));
            }

            return (metricsRows as any[]).map((row: any) => new Metrics({
                ...row,
                breakdown: breakdownMap.get(`${row.day}`) || []
            }));
        } catch (error) {
            console.error('Error reading usage data from MySQL:', error);
            return [];
        }
    }

    public async queryUsageData(since?: string, until?: string, page: number = 1, per_page: number = 28): Promise<Metrics[]> {
        await this.ensureInitialized();
        console.log('team in queryUsageData:', this.team);
        try {
            let query = `
                SELECT DATE_FORMAT(day, '%Y-%m-%d') as day, total_suggestions_count, total_acceptances_count, total_lines_suggested, total_lines_accepted, total_active_users, total_chat_acceptances, total_chat_turns, total_active_chat_users 
                FROM Metrics 
                WHERE type = ? AND scope_name = ? AND  team = ?`;

            const params: any[] = [this.type, this.scope_name,this.team];

            if (since) {
                query += ' AND day >= ?';
                params.push(since);
            }

            if (until) {
                query += ' AND day <= ?';
                params.push(until);
            }

            console.log('query:', query);
            console.log('params:', params);

            const [rows] = await this.dbConnection!.execute(query, params);
            const metrics = (rows as any[]).map((row: any) => new Metrics({
                ...row,
                breakdown: []
            }));

            for (const metric of metrics) {
                const breakdownQuery = `
                    SELECT DATE_FORMAT(day, '%Y-%m-%d') as day, language, editor, suggestions_count, acceptances_count, lines_suggested, lines_accepted, active_users 
                    FROM BreakdownData 
                    WHERE day = ? AND type = ? AND scope_name = ? AND team = ?`;
                const [breakdownRows] = await this.dbConnection!.execute(breakdownQuery, [metric.day, this.type, this.scope_name, this.team]);
                metric.breakdown = (breakdownRows as any[]).map((row: any) => new BreakdownData(row));
            }

            return metrics;
        } catch (error) {
            console.error('Error querying usage data from MySQL:', error);
            return [];
        }
    }
}
