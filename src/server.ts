import express, { Request, Response } from 'express';
import cors from 'cors';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import escapeHtml from 'escape-html';
import { Tenant } from './model/Tenant';
import { TenantServiceFactory } from './api/TenantServiceFactory'; // Import TenantServiceFactory
import { CopilotServiceFactory } from './api/CopilotServiceFactory'; //for both usage and seat service
import { ITenantStorage } from './api/ITenantStorage'; // Import ITenantStorage
import { validateScope, ScopeValidationResult } from './api/validateInput'; 

let usageService: any; // Declare usageService in a broader scope

const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'GitHub Copilot saver API',
            version: '1.0.0',
            description: 'API documentation for Copilot usage and seat management, it supports organization, team, and enterprise level data management for persistance and retrieval'
        },
        servers: [
            {
                url: `http://localhost:${port}`,
            },
        ],
        components: {
            schemas: {
                Seat: {
                    type: 'object',
                    properties: {
                        login: {
                            type: 'string',
                            description: 'The login of the user',
                        },
                        id: {
                            type: 'integer',
                            description: 'The ID of the seat',
                        },
                        assigning_team: {
                            type: 'string',
                            description: 'The team to which the seat is assigned',
                        },
                        created_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'The creation date of the seat',
                        },
                        last_activity_at: {
                            type: 'string',
                            format: 'date-time',
                            description: 'The last activity date of the seat',
                        },
                        last_activity_editor: {
                            type: 'string',
                            description: 'The editor used in the last activity',
                        },
                    },
                },
                TotalSeats: {
                    type: 'object',
                    properties: {
                        total_seats: {
                            type: 'integer',
                            description: 'The total number of seats',
                        },
                        seats: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/Seat',
                            },
                        },
                    },
                },
                Tenant: {
                    type: 'object',
                    properties: {
                        scopeType: {
                            type: 'string',
                            description: 'The scope type (organization or enterprise)',
                        },
                        scopeName: {
                            type: 'string',
                            description: 'The scope name',
                        },
                        token: {
                            type: 'string',
                            description: 'The token for authentication',
                        },
                        isActive: {
                            type: 'boolean',
                            description: 'Whether the tenant is active',
                        },
                        team: {
                            type: 'string',
                            description: 'The team slug',
                        },
                    },
                },
                BreakdownData: {
                    type: 'object',
                    properties: {
                        language: {
                            type: 'string',
                            description: 'The programming language',
                        },
                        editor: {
                            type: 'string',
                            description: 'The editor used',
                        },
                        suggestions_count: {
                            type: 'integer',
                            description: 'The number of suggestions',
                        },
                        acceptances_count: {
                            type: 'integer',
                            description: 'The number of acceptances',
                        },
                        lines_suggested: {
                            type: 'integer',
                            description: 'The number of lines suggested',
                        },
                        lines_accepted: {
                            type: 'integer',
                            description: 'The number of lines accepted',
                        },
                        active_users: {
                            type: 'integer',
                            description: 'The number of active users',
                        },
                    },
                },
                Metrics: {
                    type: 'object',
                    properties: {
                        day: {
                            type: 'string',
                            description: 'The day of the metrics',
                        },
                        total_suggestions_count: {
                            type: 'integer',
                            description: 'The total number of suggestions',
                        },
                        total_acceptances_count: {
                            type: 'integer',
                            description: 'The total number of acceptances',
                        },
                        total_lines_suggested: {
                            type: 'integer',
                            description: 'The total number of lines suggested',
                        },
                        total_lines_accepted: {
                            type: 'integer',
                            description: 'The total number of lines accepted',
                        },
                        total_active_users: {
                            type: 'integer',
                            description: 'The total number of active users',
                        },
                        total_chat_acceptances: {
                            type: 'integer',
                            description: 'The total number of chat acceptances',
                        },
                        total_chat_turns: {
                            type: 'integer',
                            description: 'The total number of chat turns',
                        },
                        total_active_chat_users: {
                            type: 'integer',
                            description: 'The total number of active chat users',
                        },
                        breakdown: {
                            type: 'array',
                            items: {
                                $ref: '#/components/schemas/BreakdownData',
                            },
                        },
                    },
                },
            },
        },
    },
    apis: ['./src/server.ts'], // Path to the API docs
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /api/:scopeType/:scopeName/copilot/billing/seats:
 *   get:
 *     summary: Get seat data for a tenant
 *     parameters:
 *       - in: path
 *         name: scopeType
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope type (organization, team, or enterprise)
 *       - in: path
 *         name: scopeName
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The page number for pagination
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The number of items per page for pagination
 *       - in: header
 *         name: authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication
 *     responses:
 *       200:
 *         description: A list of seat data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TotalSeats'
 * /api/:scopeType/:scopeName/team/:team_slug/copilot/billing/seats:
 *   get:
 *     summary: Get seat data for a tenant's team
 *     parameters:
 *       - in: path
 *         name: scopeType
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope type (organization, team, or enterprise)
 *       - in: path
 *         name: scopeName
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope name
 *       - in: path
 *         name: team_slug
 *         schema:
 *           type: string
 *         required: true
 *         description: The team slug
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The page number for pagination
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The number of items per page for pagination
 *       - in: header
 *         name: authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication
 *     responses:
 *       200:
 *         description: A list of seat data for the team
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TotalSeats'
 */

/**
 * @swagger
 * /api/:scopeType/:scopeName/copilot/usage:
 *   get:
 *     summary: Get usage data for a tenant
 *     parameters:
 *       - in: path
 *         name: scopeType
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope type (organization, team, or enterprise)
 *       - in: path
 *         name: scopeName
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The page number for pagination
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The number of items per page for pagination
 *       - in: header
 *         name: authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication
 *     responses:
 *       200:
 *         description: A list of usage data
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UsageData'
 * 
 * /api/:scopeType/:scopeName/team/:team_slug/copilot/usage:
 *   get:
 *     summary: Get usage data for a tenant's team
 *     parameters:
 *       - in: path
 *         name: scopeType
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope type (organization, team, or enterprise)
 *       - in: path
 *         name: scopeName
 *         schema:
 *           type: string
 *         required: true
 *         description: The scope name
 *       - in: path
 *         name: team_slug
 *         schema:
 *           type: string
 *         required: true
 *         description: The team slug
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The page number for pagination
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *         required: false
 *         description: The number of items per page for pagination
 *       - in: header
 *         name: authorization
 *         schema:
 *           type: string
 *         required: true
 *         description: Bearer token for authentication
 *     responses:
 *       200:
 *         description: A list of usage data for the team
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UsageData'
 */

/**
 * @swagger
 * /api/tenants:
 *   get:
 *     summary: Get all active tenants
 *     responses:
 *       200:
 *         description: A list of active tenants
 *       500:
 *         description: Error reading active tenant data
 */

/**
 * @swagger
 * /api/tenants:
 *   post:
 *     summary: Add a new tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scopeType:
 *                 type: string
 *                 description: The scope type (organization, team, or enterprise)
 *               scopeName:
 *                 type: string
 *                 description: The scope name
 *               token:
 *                 type: string
 *                 description: The token for authentication
 *               isActive:
 *                 type: boolean
 *                 description: Whether the tenant is active
 *     responses:
 *       201:
 *         description: Tenant added successfully
 *       400:
 *         description: Missing required parameters or invalid data
 *       500:
 *         description: Error adding tenant
 */

/**
 * @swagger
 * /api/tenants/delete:
 *   post:
 *     summary: Delete a tenant
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scopeType:
 *                 type: string
 *                 description: The scope type (organization, team, or enterprise)
 *               scopeName:
 *                 type: string
 *                 description: The scope name
 *               token:
 *                 type: string
 *                 description: The token for authentication
 *               team:
 *                 type: string
 *                 description: The team slug (optional)
 *     responses:
 *       201:
 *         description: Tenant removed successfully
 *       400:
 *         description: Missing required parameters or invalid data
 *       500:
 *         description: Error removing tenant
 */

// Define the job, then run scheduled job every 12 hours
const runJob = async () => {
    // Get current time, and log it. It should be date and time, local time
    console.log('Running a job at ', new Date());

    try {
        // Use TenantServiceFactory to create the appropriate ITenantStorage implementation
        const tenantStorage: ITenantStorage = TenantServiceFactory.createTenantService();
        // Call getTenantData method to get all tenants
        const tenants: Tenant[] = await tenantStorage.getTenantData();
        // filter out inactive tenants
        const activeTenants = tenants.filter((tenant) => tenant.isActive);

        // Iterate over each tenant and perform saveUsageData operation
        for (const tenant of activeTenants) {
            try {
                const now = new Date();
             //   console.log('this tenant is:', tenant);
                // get the usage service for the tenant, and save the usage data
                const usageService = await CopilotServiceFactory.createUsageService(tenant);
                await usageService.saveUsageData();
                // Get current time and log it.
                console.log(`Metrics Data saved successfully for tenant ${tenant.scopeName} at ${now}`);

                // get the seat service for the tenant, and save the seat data
                const seatService = await CopilotServiceFactory.createSeatService(tenant);
                await seatService.saveSeatData();
                // Get current time and log it.
                console.log(`Seat Data saved successfully for tenant ${tenant.scopeName} at ${now}`);
            } catch (error) {
                const now = new Date();
                console.error(`Error saving usage data for tenant ${tenant.scopeName} at ${now}:`, error);
            }
        }
    } catch (error) {
        const now = new Date();
        console.error(`Error reading tenant data at ${now}:`, error);
    }
};

// Run it once the server starts
//runJob();

// Run job every 12 hours
setInterval(runJob, 12 * 60 * 60 * 1000);

// Redirect default to /api/:scopeType/:scopeName/copilot/usage
app.get('/', (req, res) => {
    //res.redirect('/api/:scopeType/:scopeName/copilot/usage');
    res.redirect('/api/tenants');
}); 

// Call metrics service for a tenant, it may include team level. and team may be within organization or enterprise or enterprise 
app.get(['/api/:scopeType/:scopeName/copilot/usage', '/api/:scopeType/:scopeName/team/:team_slug/copilot/usage'],
    async (req: Request, res: Response): Promise<void> => {
    try {
        let { scopeType, scopeName, team_slug } = req.params;
        const { since, until, page = 1, per_page = 60 } = req.query;
        const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Bearer token

        if (!scopeType || !scopeName || !token) {
            res.status(400).send('Missing required parameters: scopeType, scopeName, token');
            return;
        }

        // Validate inputs
        const validationResult: ScopeValidationResult = validateScope(scopeType, scopeName, token, team_slug);
        if (!validationResult.isValid) {
            res.status(400).send(validationResult.errorMessage);
            return;
        }

        // Update scopeType and team_slug with normalized values
        scopeType = validationResult.normalizedScopeType;
        team_slug = validationResult.normalizedTeamSlug;

        const tenant = new Tenant(scopeType as 'organization' | 'enterprise', scopeName as string, token as string, team_slug as string, true);

        // Validate the tenant before continuing
        const isValidTenant = await tenant.validateTenant();
        if (!isValidTenant) {
            res.status(400).send('Invalid tenant data');
            return;
        }

        // Create a tenant service to save the tenant data
        const tenantService = TenantServiceFactory.createTenantService();

        // Save the tenant data
        const isTenantSaved = await tenantService.saveTenantData(tenant);
        if (!isTenantSaved) {
            res.status(400).send('The tenant data is not right, please double check the token');
            return;
        }

        // Initialize UsageService with the tenant
        const usageService = await CopilotServiceFactory.createUsageService(tenant);

        // Call the saveUsageData method
        const isUsageDataSaved = await usageService.saveUsageData();
        if (!isUsageDataSaved) {
            res.status(404).send('Failed to fetch usage data');
            return;
        }

        // Query usage data
        const data = await usageService.queryUsageData(since as string, until as string, parseInt(page as string), parseInt(per_page as string));

        // Send the data as response
        res.json(data);
    } catch (error) {
        res.status(500).send('Error fetching metrics from storage');
        return;
    }
});



// get seat for a tenant by visting /copilot/billing/seats, it maybe include team level, and team maybe within organization or enterprise or enterprise
// added team level, and team maybe within organization or enterprise or enterprise
app.get(['/api/:scopeType/:scopeName/copilot/billing/seats', '/api/:scopeType/:scopeName/team/:team_slug/copilot/billing/seats'],
    async (req, res) : Promise<void> => {
    try {
        let { scopeType, scopeName ,team_slug} = req.params;
       // const { since, until, page = 1, per_page = 60 } = req.query;
        const {  page = 1, per_page = 60 } = req.query; //the page is not used because from the mysql/file data, they already filter many unnecessary data

        const token = req.headers['authorization']?.split(' ')[1]; // Extract token from Bearer token

        if (!scopeType || !scopeName || !token) {
           res.status(400).send('Missing required parameters: scopeType, scopeName, token');
           return;
        }
        // Validate inputs
        const validationResult: ScopeValidationResult = validateScope(scopeType, scopeName, token, team_slug);
        if (!validationResult.isValid) {
            res.status(400).send(validationResult.errorMessage);
            return;
        }

        // Update scopeType and team_slug with normalized values
        scopeType = validationResult.normalizedScopeType;
        team_slug = validationResult.normalizedTeamSlug;
        // Create tenant object from parameters
        const tenant = new Tenant(scopeType as 'organization' | 'enterprise', scopeName as string, token as string, team_slug,true);

        // Validate the tenant before continue
        await tenant.validateTenant();

        // Creat a tenantservice to save the tenant data
        const tenantService = TenantServiceFactory.createTenantService();

        // save the tenant data
        // TBD: should we save the tenant data here? it is better to save it when the tenant is created. and tell the user the tenant will be saved. or it will be secure issue?
        // TBD: at least, we need a swith to control the save tenant data, so the user can choose to save the tenant data or not.
        await tenantService.saveTenantData(tenant);

        // Initialize UsageService with the tenant
        const seatService = await CopilotServiceFactory.createSeatService(tenant);

        // Call the saveUsageData method
        await seatService.saveSeatData();

        // Query usage data will get all the data,so we will call anothere method to get the latest data
       // const data = await seatService.querySeatData(since as string, until as string, parseInt(page as string), parseInt(per_page as string));
        const data = await seatService.getSeatData(parseInt(page as string), parseInt(per_page as string));
        // Send the data as response
        res.json(data);
    } catch (error) {
        res.status(500).send('Error fetching metrics from storage');
    }
});



// Endpoint to read and print all tenant data
app.get('/api/tenants', async (req, res) => {
    try {
        // Use TenantServiceFactory to create the appropriate ITenantStorage implementation
        const tenantStorage: ITenantStorage = TenantServiceFactory.createTenantService();
        // Call getActiveTenants method
        const activeTenants = await tenantStorage.getActiveTenants();
        // Print active tenant data
        console.log('Active Tenants:', activeTenants);
        res.json(activeTenants);
        return;
    } catch (error) {
        console.error('Error reading active tenant data:', error);
        res.status(500).send('Error reading active tenant data');
        return
    }
});


// New endpoint to add a tenant
app.post('/api/tenants', async (req, res): Promise<void> => {
    try {
        const { scopeType, scopeName, token, team,isActive } = req.body;
        let team_slug = team;


        if (!scopeType || !scopeName || !token) {
           res.status(400).send('Missing required parameters: scopeType, scopeName, token');
           return;
        }

        if (typeof isActive !== 'boolean') {
            res.status(400).send('isActive should be a boolean');
            return;
            // set the isActive to true if not provided
            //isActive = true;
        }
        // Validate inputs
        const validationResult: ScopeValidationResult = validateScope(scopeType, scopeName, token, team_slug);
        if (!validationResult.isValid) {
            res.status(400).send(validationResult.errorMessage);
            return;
        }

        // Create tenant object from request body
        const tenant = new Tenant(scopeType, scopeName, token,team_slug, isActive);
        
        // Validate the tenant before saving
        await tenant.validateTenant();

        // Use TenantServiceFactory to create the appropriate ITenantStorage implementation
        const tenantStorage: ITenantStorage = TenantServiceFactory.createTenantService();
        // Save the tenant data
        await tenantStorage.saveTenantData(tenant);

        res.status(201).send(`Tenant ${escapeHtml(tenant.scopeName)} added successfully`);
        
    } catch (error) {
        console.error('Error adding tenant:', error);
        res.status(500).send('Error adding tenant');
    }
});

// add a new route to delete the tenant, it should be a post method
// and the body should include the scopeType and scopeName and token, and optional team
// so that we can make the permission check
app.post('/api/tenants/delete',async (req: Request, res: Response): Promise<void> => {
    try {
        const { scopeType, scopeName, token,team } = req.body;
        let team_slug = team;

        if (!scopeType || !scopeName || !token) {
           res.status(400).send('Missing required parameters: scopeType, scopeName, token');
           return;
        }

        // Validate inputs
        const validationResult: ScopeValidationResult = validateScope(scopeType, scopeName, token, team_slug);
        if (!validationResult.isValid) {
            res.status(400).send(validationResult.errorMessage);
            return;
        }

        // Create tenant object from request body
        const tenant = new Tenant(scopeType, scopeName, token,team, true);
        
        // Validate the tenant before saving
        await tenant.validateTenant();

        // Use TenantServiceFactory to create the appropriate ITenantStorage implementation
        const tenantStorage: ITenantStorage = TenantServiceFactory.createTenantService();
        // Save the tenant data
        await tenantStorage.removeTenantData(tenant);

        res.status(201).send(`Tenant ${tenant.scopeName} removed successfully`);
        
    } catch (error) {
        console.error('Error removing tenant:', error);
        res.status(500).send('Error removing tenant');
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
