/**
 * MYRAA AI OS — Database & API Intelligence Service
 * Handles Schema Design, Migrations, Query Optimization, OpenAPI Specs, and destructive operation confirmation gates.
 */
const fs = require('fs');
const path = require('path');
const modelRouter = require('./model_router.cjs');

class DatabaseApiService {
    constructor() {}

    /**
     * Verify if a database operation contains destructive clauses requiring user confirmation
     */
    checkDestructiveSafety(query) {
        const qUpper = query.toUpperCase();
        const isDestructive = (
            qUpper.includes('DROP TABLE') ||
            qUpper.includes('DROP DATABASE') ||
            qUpper.includes('DROP SCHEMA') ||
            qUpper.includes('TRUNCATE') ||
            (qUpper.includes('DELETE FROM') && !qUpper.includes('WHERE'))
        );

        return {
            requiresConfirmation: isDestructive,
            riskLevel: isDestructive ? 'HIGH' : 'LOW',
            warning: isDestructive ? 'Destructive SQL operation detected! Explicit user confirmation required before execution.' : null
        };
    }

    /**
     * Design Schema and Idempotent Migrations
     */
    async designSchema(domainDescription, dialect = 'postgresql') {
        const prompt = `Design a normalized, scalable database schema for: "${domainDescription}". Dialect: ${dialect}.
Include table definitions, primary keys, foreign key constraints, indexes for query performance, and idempotent SQL migration statements.`;

        const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
            systemPrompt: 'You are MYRAA Principal Database Architect. Output production-ready SQL schemas with indexing best practices.'
        });

        return {
            dialect,
            model: res.model,
            schemaSql: res.text,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Generate OpenAPI 3.0 Specification
     */
    async generateOpenApiSpec(apiDescription, endpoints = []) {
        const prompt = `Generate a complete OpenAPI 3.0 YAML specification for: "${apiDescription}".\nEndpoints: ${JSON.stringify(endpoints)}`;
        const res = await modelRouter.executeWithFallback('coding', [{ role: 'user', content: prompt }], {
            systemPrompt: 'You are MYRAA API Architect. Output valid OpenAPI 3.0 YAML specs with schemas, status codes, and security definitions.'
        });

        return {
            model: res.model,
            openApiSpec: res.text,
            timestamp: new Date().toISOString()
        };
    }
}

const service = new DatabaseApiService();
module.exports = service;
