import { envConfig } from "../utils/envConfig.js";
import { logger } from "../utils/logConfig.js";

class EmailClass {
  private static instance: EmailClass;
  private from: string;

  private constructor() {
    this.from = envConfig.fromEmail;
  }

  public static getInstance(): EmailClass {
    if (!EmailClass.instance) {
      EmailClass.instance = new EmailClass();
    }
    return EmailClass.instance;
  }

  /**
   * Simulates sending an email with a 2-second delay to mimic SMTP network latency.
   */
  public async send(to: string, subject: string, body: string): Promise<boolean> {
    logger.info(`[Email Sender] Starting email transmission...`);
    logger.info(`[Email Sender] From: ${this.from}`);
    logger.info(`[Email Sender] To: ${to}`);
    logger.info(`[Email Sender] Subject: ${subject}`);
    logger.info(`[Email Sender] Body: ${body}`);

    // adding a delay of two seconds to simulate SMTP process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    logger.info(`[Email Sender] Email successfully sent to ${to}`);
    return true;
  }
}

export default EmailClass;
