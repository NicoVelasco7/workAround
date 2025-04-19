import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const rm = promisify(fs.rm);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class BotService implements OnModuleInit {
  private client: Client;
  private enterpriseId: string = '';
  private prisma = new PrismaClient();
  private readonly logger = new Logger(BotService.name);
  private userStates: Map<
    string,
    {
      numOrderCount: number;
      idPadre: string;
      advance: number;
      enter: boolean;
      processing?: boolean;
    }
  > = new Map();

  constructor(private eventEmitter: EventEmitter2) {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        protocolTimeout: 600000, // Increase the protocol timeout to 60 seconds
      },
    });
  }

  onModuleInit() {
    this.client.on('qr', (qr) => {
      this.logger.log(
        `QrCode: https://workaround-production.up.railway.app/api/bot/qrcode/421a24c1-e02d-44b3-af45-267e1b5e306c`,
      );
      this.eventEmitter.emit('qrcode.created', qr);
    });
    this.client.on('ready', async () => {
      this.logger.log("You're connected successfully!");
    });

    // this.client.on('message', async (msg) => {
    //   this.logger.verbose(`${msg.from}: ${msg.body}`);

    //   // Get or initialize the user's state
    //   if (!this.userStates.has(msg.from)) {
    //     this.userStates.set(msg.from, {
    //       numOrderCount: 0,
    //       idPadre: '',
    //       advance: 0,
    //       enter: false,
    //     });
    //   }

    //   const userState = this.userStates.get(msg.from);

    //   // Ensure userState is defined
    //   if (!userState) {
    //     this.logger.error(`User state for ${msg.from} is undefined.`);
    //     return;
    //   }

    //   // Prevent overlapping message handling for the same user
    //   if (userState.processing) {
    //     this.logger.warn(
    //       `User ${msg.from} is already being processed. Ignoring this message.`,
    //     );
    //     return;
    //   }

    //   try {
    //     // Mark the user as being processed
    //     userState.processing = true;

    //     const messages = await this.prisma.messages.findMany({
    //       where: { enterpriseId: this.enterpriseId },
    //       orderBy: { numOrder: 'asc' },
    //     });

    //     let m;

    //     if (userState.enter) {
    //       const childCount = await this.prisma.messages.count({
    //         where: { parentMessageId: userState.idPadre },
    //       });

    //       const selectedOption = parseInt(msg.body, 10);

    //       if (
    //         !isNaN(selectedOption) &&
    //         selectedOption > 0 &&
    //         selectedOption <= childCount
    //       ) {
    //         userState.advance = selectedOption;
    //         userState.numOrderCount += userState.advance;
    //       } else {
    //         await msg.reply(
    //           `Opcion Invalida. Por favor seleccione un numero entre 1 y ${childCount}.`,
    //         );
    //         const msgReturn = await this.prisma.messages.findUnique({
    //           where: { id: userState.idPadre },
    //         });

    //         if (msgReturn) {
    //           await msg.reply(msgReturn.body);
    //         } else {
    //           this.logger.warn(`No message found for id: ${userState.idPadre}`);
    //         }

    //         return;
    //       }
    //     }

    //     this.logger.log(`numOrderCount: ${userState.numOrderCount}`);

    //     for (let i = userState.numOrderCount; i <= messages.length; ) {
    //       if (
    //         messages[i]?.parentMessageId === null &&
    //         messages[i]?.option === 'MENU'
    //       ) {
    //         m = messages[i]?.body;
    //         await sleep(2000); // Delay to avoid being flagged by WhatsApp
    //         await msg.reply(m);
    //         userState.enter = true;
    //         userState.idPadre = messages[i]?.id;
    //         break;
    //       }

    //       if (
    //         messages[i]?.parentMessageId === userState.idPadre &&
    //         messages[i]?.option === 'MENU' &&
    //         messages[i]?.trigger?.toLowerCase() === msg.body.toLowerCase()
    //       ) {
    //         const counti = await this.prisma.messages.count({
    //           where: { parentMessageId: messages[i]?.id },
    //         });
    //         const x = await this.prisma.messages.findUnique({
    //           where: { id: userState?.idPadre },
    //         });
    //         m = messages[i]?.body;
    //         userState.enter = true;
    //         await sleep(2000); // Delay to avoid being flagged by WhatsApp
    //         await msg.reply(m);
    //         userState.idPadre = messages[i]?.id;
    //         break;
    //       }

    //       if (
    //         messages[i]?.parentMessageId === userState.idPadre &&
    //         messages[i]?.trigger?.toLowerCase() === msg.body.toLowerCase()
    //       ) {
    //         const counti = await this.prisma.messages.count({
    //           where: { parentMessageId: messages[i]?.id },
    //         });
    //         const x = await this.prisma.messages.findUnique({
    //           where: { id: userState.idPadre },
    //         });
    //         m = messages[i]?.body;
    //         await sleep(2000); // Delay to avoid being flagged by WhatsApp
    //         await msg.reply(m);
    //         userState.enter = false;
    //         userState.idPadre = messages[i]?.id;

    //         if (messages[i]?.finishLane === true) {
    //           userState.numOrderCount = 0;
    //           break;
    //         } else {
    //           break;
    //         }
    //       }

    //       if (i == messages.length - 1) {
    //         m = messages[i]?.body;
    //         await sleep(2000); // Delay to avoid being flagged by WhatsApp
    //         await msg.reply(m);
    //         userState.numOrderCount = 0;
    //         userState.enter = false;
    //         break;
    //       }

    //       if (userState.numOrderCount === 0) {
    //         m = messages[i]?.body;
    //         await sleep(2000); // Delay to avoid being flagged by WhatsApp
    //         await msg.reply(m);
    //         userState.enter = false;
    //         userState.numOrderCount += 1;
    //       }
    //       i++;
    //     }
    //   } catch (error) {
    //     this.logger.error(
    //       `Error processing message for user ${msg.from}: ${error.message}`,
    //     );
    //   } finally {
    //     // Mark the user as no longer being processed
    //     userState.processing = false;
    //   }
    // });

    this.client.initialize();
  }

  async setEnterpriseId(id: string) {
    this.enterpriseId = id;
  }

  async disconnect() {
    const cachePath = path.join(__dirname, '..', '..', '.wwebjs_cache');

    const deleteFolder = async (folderPath: string) => {
      try {
        if (fs.existsSync(folderPath)) {
          await rm(folderPath, { recursive: true, force: true });
        }
      } catch (error) {
        if (error.code === 'EBUSY') {
          this.logger.warn(`Resource busy, retrying: ${folderPath}`);
          await sleep(1000);
          await deleteFolder(folderPath);
        } else {
          throw error;
        }
      }
    };

    try {
      await deleteFolder(cachePath);
      await this.client.logout();
      this.logger.log('Client disconnected and folders deleted successfully.');
      this.client.initialize(); // Reiniciar el cliente después de la desconexión
      this.logger.log('Client initialized again.');
    } catch (error) {
      this.logger.error(`Error while cleaning up: ${error.message}`);
    }
  }

  async sendMessage(to: string, message: string): Promise<void> {
    const finalNumber = `54${to}`; // Add the country code to the number

    const numberDetails = await this.client.getNumberId(finalNumber);

    if (!numberDetails) {
      throw new Error(`The phone number ${to} is not registered on WhatsApp.`);
    }

    await this.client.sendMessage(numberDetails._serialized, message);

    console.log(`WhatsApp message sent to ${to}: ${message}`);
  }
}
