// src/app/api/ticket/route.ts
import { NextResponse } from 'next/server'
import path from 'path'
// @ts-ignore
import * as snarkjs from 'snarkjs'
import { writeFile } from 'fs/promises'
import fs from 'fs'
import { exec } from "child_process";
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { EdDSATicketPCD, EdDSATicketPCDPackage, ITicketData, prove } from "@pcd/eddsa-ticket-pcd"
import { newEdDSAPrivateKey } from "@pcd/eddsa-pcd"
import { ArgumentTypeName } from "@pcd/pcd-types"
import crypto from 'crypto';
import { constructZupassPcdAddRequestUrl, constructZupassPcdProveAndAddRequestUrl } from '@pcd/passport-interface'
import { sql } from '@vercel/postgres'

// Initialize database
const initializeDb = async () => {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS tickets (
                id SERIAL PRIMARY KEY,
                ticket_id TEXT UNIQUE,
                name TEXT,
                email TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `;
    } catch (error) {
        console.error('Failed to create table:', error);
    }
};

function createDeterministicUUIDv4(publicOutput: any): string {
    // Convert public output to base64
    const encoded = Buffer.from(JSON.stringify(publicOutput)).toString('base64');

    // Create a SHA-256 hash of the base64 string
    const hash = crypto.createHash('sha256').update(encoded).digest();

    // Convert hash to array of bytes
    const hashBytes = Array.from(new Uint8Array(hash));

    // Set the version bits (bits 6-7 of the 7th byte) to 0b01 for version 4
    hashBytes[6] = (hashBytes[6] & 0x0f) | 0x40;

    // Set the variant bits (bits 6-7 of the 9th byte) to 0b10
    hashBytes[8] = (hashBytes[8] & 0x3f) | 0x80;

    // Convert to hex and format as UUID
    const hex = hashBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32)
    ].join('-');
}
async function executeVerifyCommand(proof: any, publicOutput: any) {

    let tempFiles = [];

    const tempDir = os.tmpdir();
    const publicFilePath = join(tempDir, `public-${uuidv4()}.json`);
    const proofFilePath = join(tempDir, `proof-${uuidv4()}.json`);

    tempFiles.push(publicFilePath, proofFilePath);

    await Promise.all([
        writeFile(publicFilePath, JSON.stringify(publicOutput)),
        writeFile(proofFilePath, JSON.stringify(proof))
    ]);

    const executeVerification = () => {
        return new Promise<{ exitCode: number | undefined, stdout: string, stderr: string }>((resolve) => {
            const command = `snarkjs groth16 verify public/verification_key.json ${publicFilePath} ${proofFilePath}`;

            exec(command, (error, stdout, stderr) => {
                // We resolve instead of reject because we want to handle the exit code explicitly
                resolve({
                    exitCode: error ? error.code : 0,
                    stdout,
                    stderr
                });
            });
        });
    };

    // Run verification
    const result = await executeVerification();

    // Clean up: Delete temporary files
    await Promise.all(
        tempFiles.map(file => fs.promises.unlink(file))
    );

    return (result.exitCode === 0)
}

export async function POST(req: Request) {
    try {
        await initializeDb();

        // Parse the incoming request body
        const body = await req.json()
        const { proof, name, email, isInviting } = body

        if (!proof) {
            return NextResponse.json(
                { error: 'No proof provided' },
                { status: 400 }
            )
        }

        // Generate ticket ID from proof
        let ticketId;
        if (isInviting) {
            ticketId = createDeterministicUUIDv4(proof['publicOutput'] + 'ref'); //creates a new uuid for invitee
        } else {
            ticketId = createDeterministicUUIDv4(proof['publicOutput']);
        }

        // Check if ticket already exists
        const existingTicket = await sql`
            SELECT * FROM tickets WHERE ticket_id = ${ticketId}
        `;

        if (existingTicket.rows.length > 0) {
            return NextResponse.json({
                status: 'success',
                message: 'Ticket already exists',
                url: null,
                existingTicket: true
            });
        }

        console.log(JSON.stringify(proof))
        console.log(`name: ${name}, email: ${email}`)

        const isValid = await executeVerifyCommand(proof['proof'], proof['publicOutput'])
        console.log(`isValid?`, isValid)

        console.log(createDeterministicUUIDv4(proof['publicOutput']))
        // zupass ticket

        // Prepare the event ticket to sign.
        // The following are just dummy values used for testing.

        const ticketData: ITicketData = {
            attendeeName: name,
            attendeeEmail: email,
            eventName: "Devcoff",
            ticketName: "gathering",
            checkerEmail: undefined,
            ticketId,
            eventId: process.env.EVENT_ID || '',
            productId: process.env.PRODUCT_ID || "",
            timestampConsumed: 0,
            timestampSigned: Date.now(),
            attendeeSemaphoreId: "12345",
            isConsumed: false,
            isRevoked: false,
            ticketCategory: 1
        }

        await sql`
            INSERT INTO tickets (ticket_id, name, email)
            VALUES (${ticketId}, ${name}, ${email})
        `;

        const url = constructZupassPcdProveAndAddRequestUrl<typeof EdDSATicketPCDPackage>(
            "https://staging.zupass.org",
            req.headers.get("Origin") + "/popup",
            EdDSATicketPCDPackage.name,
            {
                // The id is optional and if you don't pass it a random value will be automatically created.
                id: {
                    argumentType: ArgumentTypeName.String
                },
                ticket: {
                    value: ticketData,
                    argumentType: ArgumentTypeName.Object
                },
                privateKey: {
                    argumentType: ArgumentTypeName.String,
                    value: process.env.PRIVATE_KEY || ""
                }
            },
            { title: "Devcoff" },
            false,
            "Devcoff"

        )



        return NextResponse.json({
            status: 'success',
            message: 'Proof verified successfully',
            url: url,
            tgLink: process.env.TG_LINK,
        })

    } catch (error) {
        console.error('Error verifying proof:', error)
        return NextResponse.json(
            { error: 'Error verifying proof' },
            { status: 500 }
        )
    }
}

