import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { BotService } from './bot.service';
import * as QRCode from 'qrcode';
import { Response } from 'express';
import { OnEvent } from '@nestjs/event-emitter';

@Controller('bot')
export class BotController {
  private qrCode: string;
  constructor(private botService: BotService) {}

  @OnEvent('qrcode.created')
  handleQrcodeCreatedEvent(qrCode: string) {
    this.qrCode = qrCode;
  }

  @Get('qrcode')
  async getQrCode(@Res() response: Response) {
    if (!this.qrCode) {
      return response.status(404).send('QR code not found');
    }

    response.setHeader('Content-Type', 'image/png');
    QRCode.toFileStream(response, this.qrCode);
  }

  @Post('send-message')
  async sendMessage(@Query('to') to: string, @Query('message') message: string) {
    console.log('to:', to);
    console.log('message:', message);
    await this.botService.sendMessage(to, message);
  }

  @Post('disconnect')
  async disconnect() {
    await this.botService.disconnect();
  }
}
