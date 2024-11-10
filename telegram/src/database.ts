import { DataSource } from "typeorm";
import { User } from "./entities/User";
import logger from "./logger";

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: "bot.sqlite",
    entities: [User],
    synchronize: true,
    logging: false
});

export async function initializeDatabase() {
    try {
        await AppDataSource.initialize();
        logger.info("Database initialized");
    } catch (error) {
        logger.error("Error initializing database", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        throw error;
    }
}
