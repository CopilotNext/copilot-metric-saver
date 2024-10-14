// src/api/MySQLSeatStorage.ts
import { createConnection, Connection, OkPacket, RowDataPacket } from 'mysql2/promise';
import { ISeatStorage } from './ISeatStorage';
import { Tenant } from '../model/Tenant';
import { TotalSeats, Seat } from '../model/Seat';
import { storage_config } from '../../config';

export class MySQLSeatStorage implements ISeatStorage {
    private dbConnection: Connection | null = null;
    private scope_name: string = '';
    private type: string = '';
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
            this.initialized = true;
            console.log('Database connection established successfully in seats module.');
        } catch (error) {
            console.error('Error connecting to the database:', error);
            this.initialized = false;
        }
    }

    public initializeScope(tenant: Tenant) {
        this.scope_name = tenant.scopeName;
        this.type = tenant.scopeType;
    }

    private async initializeDatabase() {
        await this.ensureInitialized();
    
        const createSeatTableQuery = `
            CREATE TABLE IF NOT EXISTS CopilotSeats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                login VARCHAR(255) NOT NULL,
                team VARCHAR(255),
                created_at DATETIME NOT NULL,
                last_activity_at DATETIME,
                last_activity_editor VARCHAR(255),
                type ENUM('organization', 'enterprise', 'team') NOT NULL,
                scope_name VARCHAR(255) NOT NULL,
                refresh_time DATETIME NOT NULL
            );
        `;
    
        await this.dbConnection!.execute(createSeatTableQuery);
        console.log('Database tables initialized for seats module');
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            console.log('Re-initializing connection...');
            await this.initConnection();
        }
    }

    public async saveSeatData(seatData: TotalSeats): Promise<boolean> {
        await this.ensureInitialized();
    
        const refreshTime = new Date(); // current time for batch refresh, it should be 
    
        const query = `
            INSERT INTO CopilotSeats (login, team, created_at, last_activity_at, last_activity_editor, type, scope_name, refresh_time)
            VALUES ?
        `;
    
        const values = seatData.seats.map(seat => [
            seat.login,
            seat.team,
            seat.created_at,
            seat.last_activity_at,
            seat.last_activity_editor,
            this.type,
            this.scope_name,
            refreshTime // same refresh time for each batch insert
        ]);
    
        try {
           // console.log('Seat data received:', JSON.stringify(seatData, null, 2));
            const [result] = await this.dbConnection!.query<OkPacket>(query, [values]);
            console.log(`Inserted rows: ${result.affectedRows}`);
            return true;
        } catch (error) {
            console.error('Error saving seat data:', error);
            return false;
        }
    }

    public async readSeatData(): Promise<TotalSeats> {
        await this.ensureInitialized();
        try {
            const query = `
                SELECT login, team, created_at, last_activity_at, last_activity_editor 
                FROM CopilotSeats 
                WHERE type = ? AND scope_name = ?`;

            const [rows] = await this.dbConnection!.execute<RowDataPacket[]>(query, [this.type, this.scope_name]);
            return new TotalSeats(rows as Seat[]);
        } catch (error) {
            console.error('Error reading seat data from MySQL:', error);
            return new TotalSeats([]);
        }
    }

    public async querySeatData(since?: string, until?: string, page: number = 1, per_page: number = 28): Promise<TotalSeats[]> {
        await this.ensureInitialized();
        try {
            let query = `
                SELECT login, team, created_at, last_activity_at, last_activity_editor 
                FROM CopilotSeats 
                WHERE type = ? AND scope_name = ?`;

            const params: any[] = [this.type, this.scope_name];

            if (since) {
                query += ' AND created_at >= ?';
                params.push(since);
            }

            if (until) {
                query += ' AND created_at <= ?';
                params.push(until);
            }

            query += ' LIMIT ? OFFSET ?';
            params.push(per_page, (page - 1) * per_page);

            const [rows] = await this.dbConnection!.execute<RowDataPacket[]>(query, params);
            return [new TotalSeats(rows as Seat[])];
        } catch (error) {
            console.error('Error querying seat data from MySQL:', error);
            return [];
        }
    }
}