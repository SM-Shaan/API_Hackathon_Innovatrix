import nodemailer from 'nodemailer';
import { Logger } from './logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private logger: Logger;
  private fromAddress: string;

  constructor(logger: Logger) {
    this.logger = logger;
    this.fromAddress = process.env.EMAIL_FROM || 'noreply@careforall.com';

    // Create transporter - use ethereal for demo/testing
    if (process.env.SMTP_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Create a test account for demo purposes
      this.transporter = nodemailer.createTransport({
        host: 'localhost',
        port: 1025, // MailHog default port
        ignoreTLS: true,
      });
      this.logger.info('Email service running in demo mode (no SMTP configured)');
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      this.logger.info({ to: options.to, subject: options.subject }, 'Sending email');

      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.info({ messageId: info.messageId }, 'Email sent successfully');

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({ error, to: options.to }, 'Failed to send email');

      // In demo mode, treat failures as success for testing
      if (!process.env.SMTP_HOST) {
        this.logger.info('Demo mode: Email would have been sent');
        return { success: true, messageId: `demo-${Date.now()}` };
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // Email templates
  static donationReceivedTemplate(data: {
    donorName: string;
    amount: number;
    campaignTitle: string;
    transactionId: string;
  }): { subject: string; html: string } {
    return {
      subject: `Thank you for your donation to ${data.campaignTitle}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">CareForAll</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Thank you, ${data.donorName}!</h2>
            <p>Your generous donation of <strong>$${data.amount.toFixed(2)}</strong> to <strong>${data.campaignTitle}</strong> has been received.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666;">Transaction ID: ${data.transactionId}</p>
            </div>
            <p>Your contribution makes a real difference. Thank you for your support!</p>
          </div>
          <div style="padding: 20px; text-align: center; color: #666; font-size: 12px;">
            <p>CareForAll - Making a difference together</p>
          </div>
        </div>
      `,
    };
  }

  static campaignGoalReachedTemplate(data: {
    ownerName: string;
    campaignTitle: string;
    goalAmount: number;
    totalRaised: number;
  }): { subject: string; html: string } {
    return {
      subject: `Congratulations! ${data.campaignTitle} reached its goal!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">CareForAll</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Congratulations, ${data.ownerName}!</h2>
            <p>Your campaign <strong>${data.campaignTitle}</strong> has reached its funding goal!</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="font-size: 36px; color: #667eea; margin: 0;">$${data.totalRaised.toFixed(2)}</p>
              <p style="color: #666; margin: 5px 0 0 0;">raised of $${data.goalAmount.toFixed(2)} goal</p>
            </div>
            <p>Thank you for using CareForAll to make a difference!</p>
          </div>
        </div>
      `,
    };
  }

  static paymentConfirmedTemplate(data: {
    donorName: string;
    amount: number;
    campaignTitle: string;
  }): { subject: string; html: string } {
    return {
      subject: `Payment confirmed for ${data.campaignTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">CareForAll</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2>Payment Confirmed!</h2>
            <p>Hi ${data.donorName},</p>
            <p>Your payment of <strong>$${data.amount.toFixed(2)}</strong> for <strong>${data.campaignTitle}</strong> has been successfully processed.</p>
            <p>Thank you for your generosity!</p>
          </div>
        </div>
      `,
    };
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}
