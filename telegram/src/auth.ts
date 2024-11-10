import { Context } from "telegraf";
import { AppDataSource } from "./database";
import { User } from "./entities/User";
import logger from "./logger";

export async function requireRegistration(ctx: Context, next: () => Promise<void>) {
    try {
        if (!ctx.from) {
            logger.warn("No user information in context");
            await ctx.reply("Unable to verify user. Please try again.");
            return;
        }

        logger.debug("Here")
        const userRepository = AppDataSource.getRepository(User);
        const user = await userRepository.findOne({
            where: { telegramId: ctx.from.id }
        });

        if (!user) {
            logger.warn("Unregistered user attempted to use protected command", {
                userId: ctx.from.id,
            });
            await ctx.reply("You need to register first! Use /signup to register.");
            return;
        }

        return next();
    } catch (error) {
        logger.error("Error in registration middleware", {
            error: error instanceof Error ? error.message : "Unknown error",
            userId: ctx.from?.id
        });
        await ctx.reply("An error occurred. Please try again later.");
    }
}
