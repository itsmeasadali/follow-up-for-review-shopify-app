import nodemailer from "nodemailer";

export function processEmailTemplate(template: string, data: {
  customer_name: string,
  order_number: string,
  product_name: string
}) {
  return template
    .replace(/{{customer_name}}/g, data.customer_name)
    .replace(/{{order_number}}/g, data.order_number)
    .replace(/{{product_name}}/g, data.product_name);
}

export async function sendEmail(to: string, subject: string, content: string) {
  try {
    console.log('Attempting to send email:', { to, subject });
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html: content,
    });

    console.log('Email sent successfully:', { to, subject, messageId: info.messageId });
    return info;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Email sending failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}