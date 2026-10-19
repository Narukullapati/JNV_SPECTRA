const PDFDocument = require('pdfkit');
const { uploadToS3, getS3PublicUrl } = require('./s3');
const { setupLogger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');
const path = require('path');
const fs = require('fs');

const logger = setupLogger();
const ZELLE_EMAIL = 'jnvcommercials@gmail.com';

const parseLocalDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    const datePart = raw.includes('T') ? raw.split('T')[0] : raw;
    const dateOnly = datePart.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateOnly) {
      const [year, month, day] = dateOnly[0].split('-').map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const format12HourTime = (value) => {
  if (!value) return 'N/A';

  const raw = String(value).trim();
  if (!raw) return 'N/A';

  const explicitMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (explicitMatch) {
    let hour = Number(explicitMatch[1]);
    const minute = explicitMatch[2];
    let meridiem = (explicitMatch[3] || '').toUpperCase();

    if (meridiem) {
      if (meridiem === 'AM' && hour === 12) hour = 0;
      if (meridiem === 'PM' && hour < 12) hour += 12;
    } else if (hour >= 12) {
      meridiem = 'PM';
      if (hour > 12) hour -= 12;
    } else {
      meridiem = 'AM';
      if (hour === 0) hour = 12;
    }

    return `${hour}:${minute} ${meridiem}`;
  }

  const isoMatch = raw.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (isoMatch) {
    let hour = Number(isoMatch[1]);
    const minute = isoMatch[2];
    let meridiem = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${meridiem}`;
  }

  return raw;
};

class PDFGenerator {
  static addWatermarkLogo(doc) {
    try {
      const logoPath = path.join(__dirname, '../../public/images/logo.png');
      if (fs.existsSync(logoPath)) {
        // Get page dimensions
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        
        // Calculate center position
        const logoWidth = 200; // Width of the watermark logo
        const logoHeight = 200; // Height of the watermark logo
        const x = (pageWidth - logoWidth) / 2;
        const y = (pageHeight - logoHeight) / 2;
        
        // Save current state
        doc.save();
        
        // Set opacity using fillOpacity
        doc.fillOpacity(0.3);
        
        // Add logo as watermark with opacity
        doc.image(logoPath, x, y, { 
          width: logoWidth, 
          height: logoHeight,
          opacity: 0.3,
        });
        
        // Restore state
        doc.restore();
      }
    } catch (error) {
      logger.warn('Error adding watermark logo:', error);
    }
  }

  static async generatePDF(doc) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.end();
    });
  }

  static async generateInvoicePDF(data) {
    try {
      const doc = new PDFDocument({ margin: 50 });

      // Add watermark logo
      PDFGenerator.addWatermarkLogo(doc);

      // Document setup - Add logo if available
      try {
        doc.image(path.join(__dirname, '../../public/images/logo.png'), 50, 45, { width: 80 });
      } catch (error) {
        logger.warn('Logo image not found, continuing with placeholder');
      }

      // Receipt Title - Large, prominent
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Receipt', 350, 50, { align: 'left' });

      // Receipt details - Right aligned
      doc.fontSize(12).font('Helvetica');
      doc.text(`Receipt #${data.invoiceNumber}`.replace('INV-', 'RC-'), 350, 100, { align: 'left' });
      doc.text(`${new Date().toLocaleDateString()}`, 350, 130, { align: 'left' });
      
      // Bill To section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Bill To', 50, 140);
      
      // Customer info - only render fields that have data
      let yPos = 160;
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      
      // Always display name
      doc.text(data.customerInfo.name, 50, yPos);
      yPos += 20;
      
      // Only show address if it exists
      if (data.customerInfo.address) {
        doc.text(data.customerInfo.address, 50, yPos);
        yPos += 20;
      }
      
      // Only show city/state/country if at least one exists
      if (data.customerInfo.city || data.customerInfo.state || data.customerInfo.country) {
        const locationParts = [
          data.customerInfo.city, 
          data.customerInfo.state, 
          data.customerInfo.country,
        ].filter(Boolean).join(', ');
        
        if (locationParts) {
          doc.text(locationParts, 50, yPos);
          yPos += 20;
        }
      }
      
       // Always display email if exists
       if (data.customerInfo.email) {
         doc.text(data.customerInfo.email, 50, yPos);
         yPos += 20;
       }

       // Event Details section
       doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
       doc.text('Event Details', 50, yPos + 10);

       yPos += 35;
       doc.fontSize(12).font('Helvetica').fillColor('#333333');
       doc.text(`Event Date: ${data.orderDetails.eventDate}`, 50, yPos);
       yPos += 20;
       doc.text(`Event Time: ${data.orderDetails.eventTime}`, 50, yPos);
        yPos += 20;

        // Create a clean table with column headers
        const tableTop = yPos + 20;
      const colHeaders = ['Quantity', 'Description', 'Unit Price', 'Amount'];
      const colWidths = [80, 250, 100, 100];
      const colPos = [50, 130, 380, 480];
      
      // Draw table headers
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
      colHeaders.forEach((header, i) => {
        doc.text(header, colPos[i], tableTop);
      });
      
      // Add a horizontal line after headers
      doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

      // Draw table rows
      let y = tableTop + 30;
      doc.fontSize(12).font('Helvetica');
      
      // Check if items exist in the expected format
      const items = data.orderDetails.items || [];
      
      if (items && Array.isArray(items) && items.length > 0) {
        // Render each item in the order
        items.forEach((item) => {
          const quantity = item.quantity || 1;
          const name = item.name || item.description || 'Item';
          const price = parseFloat(item.price) || 0;
          const amount = price * quantity;
          
          doc.text(quantity.toString(), colPos[0], y);
          doc.text(name, colPos[1], y);
          doc.text(`$${price.toFixed(2)}`, colPos[2], y);
          doc.text(`$${amount.toFixed(2)}`, colPos[3], y);
          y += 25;
        });
      } else {
        // If no items, add a generic service entry based on order details
        const serviceName = data.orderDetails.serviceType || 'Service';
        const servicePrice = parseFloat(data.orderDetails.subtotal) || 0;
        
        doc.text('1', colPos[0], y);
        doc.text(serviceName, colPos[1], y);
        doc.text(`$${servicePrice.toFixed(2)}`, colPos[2], y);
        doc.text(`$${servicePrice.toFixed(2)}`, colPos[3], y);
        y += 25;
      }
      
      // Add a horizontal line after items
      doc.moveTo(50, y).lineTo(550, y).stroke();
      y += 20;

      // Subtotal, Tax, and Total
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      doc.text('Subtotal', 380, y);
      doc.text(`$${data.orderDetails.subtotal.toFixed(2)}`, colPos[3], y);
      y += 25;
      
      doc.text('Tax', 380, y);
      doc.text(`$${data.orderDetails.tax.toFixed(2)}`, colPos[3], y);
      y += 25;
      
      // Add a horizontal line before total
      doc.moveTo(380, y).lineTo(550, y).stroke();
      y += 10;
      
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text('Total', 380, y);
      doc.text(`$${Number(data.orderDetails.total || 0).toFixed(2)}`, colPos[3], y);
      
      // Thank you note
      y += 60;
      doc.fontSize(12).font('Helvetica');
      doc.text('Thank you for your business!', 50, y);
      
      // Payment method
      y += 25;
      doc.text(`Payment: ${data.paymentInfo ? data.paymentInfo.method : 'Credit Card'}`, 50, y);
      y += 20;
      doc.text('Alternate payment option: Zelle', 50, y);
      doc.text(`Email: ${ZELLE_EMAIL}`, 50, y + 18);

      // Generate PDF buffer
      const pdfBuffer = await PDFGenerator.generatePDF(doc);

      // Upload to S3
      const fileName = `documents/invoice-INV-${data.invoiceNumber}.pdf`;
      await uploadToS3(fileName, pdfBuffer, 'application/pdf');

      // Get public URL
      const publicUrl = getS3PublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      logger.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

   static generateInvoiceTemplate(orderData) {
     return {
       documentType: 'invoice',
       invoiceNumber: `INV-${orderData.id}`,
       companyInfo: {
         name: 'JNV Events',
         address: '123 Event Street, City, Country',
         phone: '+1 234 567 8900',
         email: 'info@jnvevents.com',
       },
       customerInfo: {
         name: orderData.customer_name,
         email: orderData.email,
         phone: orderData.contact_number || 'N/A',
       },
       orderDetails: {
         date: new Date().toLocaleDateString(),
         eventDate: parseLocalDate(orderData.event_date)?.toLocaleDateString() || 'N/A',
         eventTime: format12HourTime(orderData.event_time),
         services: orderData.order_details.items.map((item) => ({
           name: item.name,
           price: item.price,
         })),
         subtotal: orderData.order_details.subtotal,
         tax: orderData.order_details.tax,
         total: orderData.total_amount,
       },
       paymentInfo: {
         depositAmount: orderData.deposit_amount,
         balanceAmount: orderData.balance_amount,
         totalAmount: orderData.total_amount,
         paymentStatus: orderData.payment_status,
       },
     };
   }

  static generateQuotationTemplate(orderData) {
    // Ensure we have a valid order ID
    const orderId = orderData.id || orderData._id || Date.now().toString();
    
      return {
       documentType: 'invoice',
       quotationNumber: `INV-${orderId}`,
       companyInfo: {
         name: 'JNV Events',
         address: '123 Event Street, City, Country',
         phone: '+1 234 567 8900',
         email: 'info@jnvevents.com',
       },
       customerInfo: {
         name: orderData.customer_name,
         email: orderData.email,
         phone: orderData.contact_number || 'N/A',
       },
       orderDetails: {
         date: new Date().toLocaleDateString(),
         eventDate: parseLocalDate(orderData.event_date)?.toLocaleDateString() || 'N/A',
         eventTime: format12HourTime(orderData.event_time),
         items: Array.isArray(orderData.order_details?.items) ? orderData.order_details.items : [{
           name: 'Event Services',
           price: orderData.total_amount,
           quantity: 1,
         }],
         subtotal: orderData.order_details?.subtotal || orderData.total_amount,
         tax: orderData.order_details?.tax || 0,
         total: orderData.total_amount,
       },
       paymentInfo: {
         depositAmount: orderData.deposit_amount,
         balanceAmount: orderData.balance_amount,
         totalAmount: orderData.total_amount,
       },
       terms: 'This invoice is valid for 30 days from the date of issue.',
       validity: '30 days',
     };
  }

  static async generateQuotationPDF(data) {
    try {
      const doc = new PDFDocument({ margin: 50 });

      // Add watermark logo
      PDFGenerator.addWatermarkLogo(doc);

      const isDeposit = data.isDeposit;
      const paymentType = isDeposit ? 'Deposit' : 'Final';

      // Document setup - Add logo if available
      try {
        doc.image(path.join(__dirname, '../../public/images/logo.png'), 50, 45, { width: 80 });
      } catch (error) {
        logger.warn('Logo image not found, continuing with placeholder');
      }

      // Invoice Title - Large, prominent
      doc.fontSize(36).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Invoice', 350, 50, { align: 'left' });

      // Invoice details - Right aligned
      doc.fontSize(12).font('Helvetica');
      doc.text(`Invoice #${data.quotationNumber}`, 350, 100, { align: 'left' });
      doc.text(`${new Date().toLocaleDateString()}`, 350, 130, { align: 'left' });
      
      // Bill To section
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Bill To', 50, 140);
      
      // Customer info
      let yPos = 160;
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      doc.text(data.customerInfo.name, 50, yPos);
      yPos += 20;
      doc.text(data.customerInfo.email, 50, yPos);
      yPos += 20;
      if (data.customerInfo.phone) {
        doc.text(data.customerInfo.phone, 50, yPos);
        yPos += 20;
      }

      // Event Details - show event date and time on invoice PDF
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Event Details', 50, yPos + 10);
      yPos += 35;
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      if (data.orderDetails.eventDate) {
        doc.text(`Event Date: ${data.orderDetails.eventDate}`, 50, yPos);
        yPos += 20;
      }
      if (data.orderDetails.eventTime) {
        doc.text(`Event Time: ${data.orderDetails.eventTime}`, 50, yPos);
        yPos += 20;
      }

       // Create a clean table with column headers
       const tableTop = yPos + 20;
      const colHeaders = ['Description', 'Quantity', 'Unit Price', 'Amount'];
      const colWidths = [250, 80, 100, 100];
      const colPos = [50, 300, 380, 480];
      
      // Draw table headers
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333');
      colHeaders.forEach((header, i) => {
        doc.text(header, colPos[i], tableTop);
      });
      
      // Add a horizontal line after headers
      doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

      // Draw table rows
      let y = tableTop + 30;
      doc.fontSize(12).font('Helvetica');
      
      // Add items to the table
      if (data.orderDetails.items && data.orderDetails.items.length > 0) {
        data.orderDetails.items.forEach((item) => {
          doc.text(item.name, colPos[0], y);
          doc.text((item.quantity || 1).toString(), colPos[1], y);
          doc.text(`$${item.price.toFixed(2)}`, colPos[2], y);
          doc.text(`$${(item.price * (item.quantity || 1)).toFixed(2)}`, colPos[3], y);
          y += 20;
        });
      }

      // Add subtotal, tax, and total
      y += 20;
      doc.text('Subtotal:', colPos[2], y);
      doc.text(`$${data.orderDetails.subtotal.toFixed(2)}`, colPos[3], y);
      
      y += 20;
      doc.text('Tax:', colPos[2], y);
      doc.text(`$${Number(data.orderDetails.tax || 0).toFixed(2)}`, colPos[3], y);
      
      if (!isDeposit) {
        y += 20;
        doc.font('Helvetica');
        doc.text('Deposit Required:', colPos[2], y);
        doc.text(`$${Number(data.paymentInfo.depositAmount || 0).toFixed(2)}`, colPos[3], y);

        y += 20;
        doc.font('Helvetica-Bold');
        doc.text('Final Amount:', colPos[2], y);
        doc.text(`$${Number(data.orderDetails.total || 0).toFixed(2)}`, colPos[3], y);
      
      }

      // Add payment information
      y += 40;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Payment Information', 50, y);
      
      y += 20;
      doc.fontSize(12).font('Helvetica');
      doc.text(data.paymentTerms || 'Payment details will be provided separately', 50, y);
      
      if (data.paymentLink) {
        y += 20;
        doc.fillColor('#0066cc');
        doc.text(data.paymentLink, 50, y, { link: data.paymentLink });
      }

      // Add alternate payment options
      y += 25;
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      doc.text('Alternate payment option: Zelle', 50, y);
      doc.text(`Email: ${ZELLE_EMAIL}`, 50, y + 18);

      // Add validity period
      y += 40;
      doc.fontSize(12).font('Helvetica').fillColor('#333333');
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30); // 30 days from now
      doc.text(`Valid until: ${validUntil.toLocaleDateString()}`, 50, y);
      
      // Add Terms and Conditions section
      y += 40;
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333');
      doc.text('Terms and Conditions', 50, y);
      
      y += 20;
      doc.fontSize(10).font('Helvetica').fillColor('#333333');
     const termsText = `• Validity: This invoice is valid for 30 days from the invoice date.
• Deposit: Above mentioned amount is required to confirm booking. Balance due before the event.
• Cancellation: 30 days prior notice is required for free cancellation. Beyond that, cancellation charges will be applied depending on the number of days before the event.
• Power Requirements: Client is responsible for arranging Electricity for the equipment.
• Equipment Usage:
   - Clients must use the above mentioned rental equipment solely for the agreed-upon purpose.
   - Any damage caused due to improper use, negligence, or mishandling will be the Client's responsibility.
   - Unauthorized modifications or tampering with the equipment is strictly prohibited.
• Damage Liability:
   - The Client assumes full responsibility for any damage, loss or theft of the rented equipment during the rental period.
   - In case of damage, repair costs or full replacement fees will be charged based on the severity of the damage.
   - JNV Spectra is not liable for any indirect or consequential damages.`;
      doc.text(termsText, 50, y + 10, { width: 500, lineGap: 3 });

      // Generate PDF buffer
      const pdfBuffer = await PDFGenerator.generatePDF(doc);

      // Upload to S3
      const fileName = `documents/invoice-${Date.now()}.pdf`;
      await uploadToS3(fileName, pdfBuffer, 'application/pdf');

      // Get public URL
      const publicUrl = getS3PublicUrl(fileName);

      // Return both the public URL and the raw PDF buffer so callers can optionally
      // persist the file locally (useful for dev/debugging) without re-generating.
      return {
        pdfUrl: publicUrl,
        paymentLink: data.paymentLink,
        buffer: pdfBuffer,
      };
    } catch (error) {
      logger.error('Error generating quotation PDF:', error);
      throw error;
    }
  }

  static async generatePaymentReceiptPDF(data) {
    try {
      const doc = new PDFDocument({ margin: 50 });
      
      // PDF Buffer
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      
      // Add company logo
      this.addLogo(doc);
      
      // Add receipt title
      doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown();
      
      // Add receipt number and date
      doc.fontSize(10);
      doc.text(`Receipt Number: ${data.receipt_id || `RC-${Date.now()}`}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();
      
      // Customer Information
      this.addCustomerInfo(doc, data.customerInfo);
      doc.moveDown();
      
      // Order Information
      doc.fontSize(12).text('Payment Details:', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Order ID: ${data.order_id}`);
      doc.text(`Payment Date: ${data.payment_date || new Date().toLocaleDateString()}`);
      doc.text(`Payment Method: ${data.payment_method || 'Online Payment'}`);
      doc.text(`Amount Paid: $${data.amount_paid.toFixed(2)}`);
      doc.moveDown();
      
      // Payment Status
      doc.fontSize(14).text('Payment Status: PAID', { align: 'center', color: 'green' });
      doc.moveDown();
      
      // Thank you note
      doc.fontSize(10);
      doc.text('Thank you for your payment!', { align: 'center' });
      doc.text('This receipt serves as confirmation of your payment.', { align: 'center' });
      doc.moveDown();
      
      // Footer
      doc.fontSize(8);
      doc.text('For any inquiries, please contact support@jnvevents.com', { align: 'center' });
      
      // Finalize the PDF and end the stream
      doc.end();
      
      // When the stream is done, combine all chunks and create a buffer
      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          const pdfBuffer = Buffer.concat(buffers);
          
          try {
            // Generate a unique file name for the payment receipt
            const fileName = `documents/receipt-RC-${data.receipt_id || Date.now()}.pdf`;
            
            // Upload to S3
            await uploadToS3(fileName, pdfBuffer, 'application/pdf');
            
            // Get public URL
            const publicUrl = getS3PublicUrl(fileName);
            
            resolve({ url: publicUrl, buffer: pdfBuffer });
          } catch (err) {
            logger.error('Error in receipt generation process:', err);
            reject(err);
          }
        });
      });
    } catch (error) {
      logger.error('Error generating payment receipt:', error);
      throw error;
    }
  }
}

module.exports = PDFGenerator;