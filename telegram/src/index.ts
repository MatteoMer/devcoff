import "reflect-metadata";
import { Telegraf, Context } from 'telegraf';
import * as dotenv from 'dotenv';
import logger from './logger';
import { initializeDatabase, AppDataSource } from './database';
import { User } from './entities/User';
import { requireRegistration } from './auth';
dotenv.config();

if (!process.env.CHANNEL_ID) {
    logger.error('CHANNEL_ID is not set in environment variables');
    process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.command('signup', async (ctx) => {
    try {
        if (!ctx.from) {
            logger.warn("No user information in signup request");
            await ctx.reply("Unable to process signup. Please try again.");
            return;
        }

        const userRepository = AppDataSource.getRepository(User);

        // Check if user already exists
        const existingUser = await userRepository.findOne({
            where: { telegramId: ctx.from.id }
        });

        if (existingUser) {
            logger.info("User attempted to register again", {
                userId: ctx.from.id,
                username: ctx.from.username
            });
            await ctx.reply("You're already registered!");
            return;
        }

        // TODO: verify zupass

        // Create new user
        const user = new User({
            telegramId: ctx.from.id,
        });

        await userRepository.save(user);

        await ctx.reply("Registration successful! You can now use all bot commands.");
    } catch (error) {
        logger.error("Error in signup process", {
            error: error instanceof Error ? error.message : "Unknown error",
            userId: ctx.from?.id
        });
        await ctx.reply("Sorry, there was an error processing your registration. Please try again later.");
    }
});

bot.use(async (ctx: Context, next) => {
    const start = Date.now();
    const update = ctx.update;

    logger.info(`Received update [${update.update_id}]`, {
        updateType: 'message' in update ? 'message' :
            'callback_query' in update ? 'callback_query' :
                'other',
        from: ctx.from?.id
    });

    await next();

    const ms = Date.now() - start;
    logger.debug(`Response time: ${ms}ms`);
});

bot.catch((err: unknown, ctx) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    const errorStack = err instanceof Error ? err.stack : undefined;
    logger.error('Bot error', {
        error: errorMessage,
        stack: errorStack,
        update: ctx.update,
        user: ctx.from?.id,
        chat: ctx.chat?.id
    });
});

bot.command('send', requireRegistration, async (ctx) => {
    try {
        const message = ctx.message.text.split(' ').slice(1).join(' ');

        if (!message) {
            logger.warn('Empty message received for /send command', {
                user: ctx.from.id,
                chat: ctx.chat.id
            });

            await ctx.reply('Please provide a message to send. Usage: /send your message here');
            return;
        }

        logger.info('Attempting to send message to channel', {
            user: ctx.from.id,
            channelId: process.env.CHANNEL_ID,
            messageLength: message.length
        });

        await bot.telegram.sendMessage(process.env.CHANNEL_ID!, message);

        logger.info('Successfully sent message to channel', {
            user: ctx.from.id,
            channelId: process.env.CHANNEL_ID
        });

        await ctx.reply('Message sent to channel successfully!');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        logger.error('Failed to send message to channel', {
            error: errorMessage,
            user: ctx.from.id,
            channelId: process.env.CHANNEL_ID
        });

        await ctx.reply('Failed to send message to channel. Please make sure the bot is an admin in the channel and has permission to post messages.');
    }
});

// Command handler for /hello
bot.command('hello', (ctx) => {
    logger.info('Handling /helloo command', {
        user: ctx.from.id,
        username: ctx.from.username,
        chat: ctx.chat.id
    });

    return ctx.reply('Hello!')
        .then(() => {
            logger.debug('Successfully sent hello message', {
                user: ctx.from.id,
                chat: ctx.chat.id
            });
        })
        .catch(error => {
            logger.error('Failed to send hello message', {
                error: error.message,
                user: ctx.from.id,
                chat: ctx.chat.id
            });
        });
});

async function startBot() {
    try {
        await initializeDatabase();

        await bot.launch();
        logger.info('Bot successfully started');
    } catch (error) {
        logger.error('Failed to start application', {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        process.exit(1);
    }
}

startBot();

process.once('SIGINT', () => {
    logger.info('Received SIGINT signal, shutting down...');
    bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
    logger.info('Received SIGTERM signal, shutting down...');
    bot.stop('SIGTERM');
});
