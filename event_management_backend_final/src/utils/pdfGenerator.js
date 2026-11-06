const PDFDocument = require('pdfkit');
const https = require('https');
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

  static customerShortCode(name) {
    const words = String(name || 'customer')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) return 'CUST';
    const code = (words[0].slice(0, 4) + words.slice(1).map((w) => w[0]).join('')).toUpperCase();
    return code.slice(0, 6);
  }

  static invoiceFileName(customerName) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const p = (n) => String(n).padStart(2, '0');
    const ampm = d.getHours() >= 12 ? 'pm' : 'am';
    const h = d.getHours() % 12 || 12;
    return `documents/inv_${PDFGenerator.customerShortCode(customerName)}_${months[d.getMonth()]}_${p(d.getDate())}_${d.getFullYear()}_${p(h)}_${p(d.getMinutes())}_${p(d.getSeconds())}_${ampm}.pdf`;
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
       paymentOption: orderData.payment_option,
       orderStatus: orderData.order_status,
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
         subtotal: orderData.order_details.subtotal,
         tax: orderData.order_details.tax_amount || orderData.order_details.tax || 0,
         tax_amount: orderData.order_details.tax_amount || 0,
         tax_percentage: orderData.order_details.tax_percentage || 0,
         total: orderData.total_amount,
       },
       paymentInfo: {
         depositAmount: orderData.deposit_amount,
         payments: Array.isArray(orderData.order_details?.payments) ? orderData.order_details.payments : [],
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
       quotationNumber: `INV-${new Date(orderData.created_at || Date.now()).getTime()}`,
       companyInfo: {
         name: 'JNV Events',
         address: '123 Event Street, City, Country',
         phone: '+1 234 567 8900',
         email: 'info@jnvevents.com',
       },
       paymentOption: orderData.payment_option,
       orderStatus: orderData.order_status,
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
         tax: orderData.order_details?.tax_amount || orderData.order_details?.tax || 0,
         tax_amount: orderData.order_details?.tax_amount || 0,
         tax_percentage: orderData.order_details?.tax_percentage || 0,
         total: orderData.total_amount,
       },
       paymentInfo: {
         depositAmount: orderData.deposit_amount,
         payments: Array.isArray(orderData.order_details?.payments) ? orderData.order_details.payments : [],
         balanceAmount: orderData.balance_amount,
         totalAmount: orderData.total_amount,
       },
       terms: 'This invoice is valid for 30 days from the date of issue.',
       validity: '30 days',
     };
  }

  static fetchQRCodeImage(text) {
    return new Promise((resolve) => {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
      const req = https.get(url, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(res.statusCode === 200 ? Buffer.concat(chunks) : null));
      });
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
      req.on('error', () => resolve(null));
    });
  }

  static async generateQuotationPDF(data) {
    try {
      const doc = new PDFDocument({ margin: 50 });

      const PURPLE = '#4b1248';
      const GRAY = '#666666';
      const LM = 50;
      const RM = doc.page.width - 50;

      // Header: purple chip + logo
      doc.rect(LM, 42, 54, 54).fill(PURPLE);
      try {
        doc.image(path.join(__dirname, '../../public/images/logo.png'), LM + 5, 47, { fit: [44, 44], align: 'center', valign: 'center' });
      } catch (error) {
        logger.warn('Logo image not found, continuing with placeholder');
      }
      doc.fillColor(PURPLE).fontSize(20).font('Helvetica-Bold').text('JNV Spectra', LM + 64, 46);
      doc.fillColor(GRAY).fontSize(9).font('Helvetica')
        .text('Event Management & Rentals', LM + 64, 68)
        .text('info@jnvspectra.com  |  +1 (941) 773-3879', LM + 64, 80);

      // QR code to online invoice (orderId recovered from quotationNumber suffix)
      const orderIdForQr = (data.quotationNumber || '').replace('INV-', '');
      const viewUrl = `https://admin.jnvspectra.com/invoice/${orderIdForQr}`;
      const qrBuf = await PDFGenerator.fetchQRCodeImage(viewUrl);
      if (qrBuf) {
        doc.rect(486, 40, 76, 76).strokeColor('#dddddd').stroke();
        doc.image(qrBuf, 488, 42, { width: 72, height: 72 });
      }
      doc.fontSize(9).fillColor(GRAY)
        .text(data.quotationNumber, 460, 120, { width: 102, align: 'right' })
        .fontSize(8).text('Scan to view online', 460, 131, { width: 102, align: 'right' });

      // Divider
      doc.moveTo(LM, 150).lineTo(RM, 150).strokeColor('#dddddd').lineWidth(1).stroke();

      // Bill to (left) + meta grid (right)
      let y = 166;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(GRAY).text('Bill to', LM, y);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#222222').text(data.customerInfo.name || '', LM, y + 14);
      doc.fontSize(9).font('Helvetica').fillColor('#333333')
        .text(data.customerInfo.email || '', LM, y + 30)
        .text(data.customerInfo.phone || 'N/A', LM, y + 43);

      const meta = [
        ['Invoice number', data.quotationNumber],
        ['Date', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
        ['Payment terms', data.paymentOption === 'online' ? 'Online' : 'Offline'],
        ['Due date', data.orderDetails.eventDate || 'N/A'],
        ['Event on', `${data.orderDetails.eventDate || 'N/A'} ${data.orderDetails.eventTime || ''}`.trim()],
        ['Status', data.orderStatus || ''],
      ];
      let my = y;
      meta.forEach(([k, v]) => {
        doc.fontSize(9).font('Helvetica').fillColor(GRAY).text(k, 320, my);
        doc.fontSize(9).font('Helvetica').fillColor('#222222').text(String(v || ''), 440, my, { width: 122, align: 'right' });
        my += 15;
      });

      // Items table
      const tableTop = Math.max(y + 60, my + 8);
      doc.rect(LM, tableTop, RM - LM, 18).fill('#f5f5f5');
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
        .text('Item summary', LM + 6, tableTop + 5)
        .text('Qty', 350, tableTop + 5)
        .text('Rate', 420, tableTop + 5, { width: 60, align: 'right' })
        .text('Total', 480, tableTop + 5, { width: 76, align: 'right' });
      doc.rect(LM, tableTop, RM - LM, 18).strokeColor('#dddddd').stroke();

      let ry = tableTop + 26;
      doc.fontSize(9).font('Helvetica').fillColor('#333333');
      const items = (data.orderDetails.items && data.orderDetails.items.length)
        ? data.orderDetails.items
        : [{ name: 'Event Services', price: data.orderDetails.total, quantity: 1 }];
      items.forEach((item) => {
        doc.text(item.name, LM + 6, ry, { width: 290 })
          .text(String(item.quantity || 1), 350, ry)
          .text(`$${Number(item.price).toFixed(2)}`, 420, ry, { width: 60, align: 'right' })
          .text(`$${(Number(item.price) * (item.quantity || 1)).toFixed(2)}`, 480, ry, { width: 76, align: 'right' });
        ry += 20;
        doc.moveTo(LM, ry - 6).lineTo(RM, ry - 6).strokeColor('#eeeeee').lineWidth(0.5).stroke();
      });
      ry += 14;

      // Payment Information (left) + totals (right)
      const botY = ry;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text('Payment Information', LM, botY);
      doc.fontSize(8).font('Helvetica').fillColor(GRAY)
        .text(data.paymentTerms || 'Payment details will be provided separately', LM, botY + 15)
        .text('Alternate payment option: Zelle', LM, botY + 27)
        .text(`Email: ${ZELLE_EMAIL}`, LM, botY + 39);
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 30);
      doc.text(`Valid until: ${validUntil.toLocaleDateString()}`, LM, botY + 51);
      if (data.paymentLink) {
        doc.fillColor('#0066cc').text(data.paymentLink, LM, botY + 63, { link: data.paymentLink, width: 240 });
      }

      const taxPct = Number(data.orderDetails.tax_percentage || 0)
        || (Number(data.orderDetails.subtotal) > 0 ? (Number(data.orderDetails.tax || 0) / Number(data.orderDetails.subtotal)) * 100 : 0);
      const taxAmt = Number(data.orderDetails.tax_amount || data.orderDetails.tax || 0);
      const tRows = [
        ['Subtotal:', `$${Number(data.orderDetails.subtotal || data.orderDetails.total || 0).toFixed(2)}`, false],
        [`Tax (${Number(taxPct.toFixed(2))}%):`, `$${taxAmt.toFixed(2)}`, false],
        ['Grand Total:', `$${Number(data.orderDetails.total || 0).toFixed(2)}`, true],
        ['Deposit Required:', `$${Number(data.paymentInfo.depositAmount || 0).toFixed(2)}`, false],
      ];
      let ty = botY;
      tRows.forEach(([label, val, bold]) => {
        doc.fontSize(bold ? 11 : 10).font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(bold ? '#222222' : '#555555').text(label, 330, ty, { width: 116 })
          .fillColor('#222222').text(val, 446, ty, { width: 116, align: 'right' });
        ty += bold ? 18 : 15;
      });
      const pmts = Array.isArray(data.paymentInfo.payments) ? data.paymentInfo.payments : [];
      if (pmts.length) {
        ty += 6;
        doc.moveTo(330, ty - 4).lineTo(562, ty - 4).strokeColor('#dddddd').lineWidth(0.5).stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333').text('Payments received:', 330, ty);
        ty += 11;
        let paid = 0;
        pmts.forEach((pm) => {
          const amt = Number(pm.amount) || 0; paid += amt;
          doc.fontSize(8).font('Helvetica').fillColor('#555555')
            .text(`${pm.method || ''}${pm.note ? ' — ' + pm.note : ''}`, 330, ty, { width: 170 })
            .fillColor('#222222').text(`$${amt.toFixed(2)}`, 446, ty, { width: 116, align: 'right' });
          ty += 12;
        });
        doc.fontSize(9).font('Helvetica').fillColor('#333333').text('Total paid:', 330, ty, { width: 116 })
          .text(`$${paid.toFixed(2)}`, 446, ty, { width: 116, align: 'right' });
        ty += 14;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#222222').text('Balance due:', 330, ty, { width: 116 })
          .text(`$${Math.max(0, Number(data.orderDetails.total || 0) - paid).toFixed(2)}`, 446, ty, { width: 116, align: 'right' });
        ty += 16;
      }
      ry = Math.max(ry, ty + 6) + 14;

      // Terms and Conditions
      doc.moveTo(LM, ry).lineTo(RM, ry).strokeColor('#dddddd').lineWidth(0.5).stroke();
      ry += 12;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333').text('Terms and Conditions', LM, ry);
      ry += 15;
      doc.fontSize(7.5).font('Helvetica').fillColor(GRAY);
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
      doc.text(termsText, LM, ry, { width: 512, lineGap: 2 });

      // Footer
      const fy = doc.y + 20;
      doc.moveTo(LM, fy).lineTo(RM, fy).strokeColor('#dddddd').lineWidth(0.5).stroke();
      doc.fontSize(8).fillColor(GRAY).text(`View this invoice online: ${viewUrl}`, LM, fy + 8, { align: 'center', width: 512 });
      doc.text('JNV Spectra - Event Management & Rentals - info@jnvspectra.com - +1 (941) 773-3879', LM, fy + 20, { align: 'center', width: 512 });

      // Generate PDF buffer
      const pdfBuffer = await PDFGenerator.generatePDF(doc);

      // Upload to S3
      const fileName = PDFGenerator.invoiceFileName(data.customerInfo && data.customerInfo.name);
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