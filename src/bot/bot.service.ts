import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const rm = promisify(fs.rm);

@Injectable()
export class BotService implements OnModuleInit {
  private client: Client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      protocolTimeout: 600000, // Increase the protocol timeout to 60 seconds
    },
  });
  private readonly logger = new Logger(BotService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.client.on('qr', (qr) => {
      this.eventEmitter.emit('qrcode.created', qr);
    });

    this.client.on('ready', async () => {
      this.logger.log("You're connected successfully!");
    });

    this.client.initialize();
  }

  async sendMessage(to: string, message: string): Promise<void> {
    if (!this.client) {
        this.logger.error('Cannot send message: WhatsApp client is not initialized or ready.');
        throw new Error('WhatsApp client not ready.');
    }
    // Add validation for the 'to' parameter
    if (!to || typeof to !== 'string' || to.trim() === '') {
        this.logger.error(`Invalid 'to' parameter received: ${to}`);
        throw new BadRequestException('Invalid phone number provided.');
    }
    try {
      const finalNumber = `54${to}`; // Add the country code to the number
      this.logger.log(`Attempting to send message to ${finalNumber}`);
      const numberDetails = await this.client.getNumberId(finalNumber);

      if (!numberDetails) {
        this.logger.warn(`Phone number ${to} (${finalNumber}) is not registered on WhatsApp.`);
        throw new Error(`The phone number ${to} is not registered on WhatsApp.`);
      }

      await this.client.sendMessage(numberDetails._serialized, message);
      this.logger.log(`WhatsApp message sent to ${to}: ${message}`);
    } catch (error) {
      // Check if the error is due to an invalid WID, which often happens with incorrect numbers
      if (error.message?.includes('invalid wid')) {
          this.logger.error(`Error sending WhatsApp message to ${to}: Invalid number format or number does not exist. Original error: ${(error as Error).message}`);
          throw new BadRequestException(`Invalid phone number format or the number ${to} does not exist on WhatsApp.`);
      }
      this.logger.error(`Error sending WhatsApp message to ${to}:`, (error as Error).message);
      throw error; // Re-throw the error after logging
    }
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
}
