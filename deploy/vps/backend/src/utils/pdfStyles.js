const PDFDocument = require('pdfkit');

const COLORS = {
  primary: '#2c3e50',
  secondary: '#34495e',
  accent: '#3498db',
  text: '#2c3e50',
  light: '#ecf0f1',
  dark: '#2c3e50',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
};

const STYLES = {
  title: {
    fontSize: 24,
    color: COLORS.primary,
    font: FONTS.bold,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.secondary,
    font: FONTS.bold,
  },
  header: {
    fontSize: 14,
    color: COLORS.dark,
    font: FONTS.bold,
  },
  body: {
    fontSize: 12,
    color: COLORS.text,
    font: FONTS.regular,
  },
  small: {
    fontSize: 10,
    color: COLORS.text,
    font: FONTS.regular,
  },
};

const drawHeader = (doc, title, documentNumber) => {
  // Draw colored header bar
  doc.rect(0, 0, 612, 100)
    .fill(COLORS.primary);
  
  // Add title
  doc.font(FONTS.bold)
    .fontSize(24)
    .fillColor(COLORS.light)
    .text(title, 50, 30, { align: 'left' });
  
  // Add document number
  doc.font(FONTS.regular)
    .fontSize(14)
    .fillColor(COLORS.light)
    .text(documentNumber, 50, 60, { align: 'left' });
  
  // Reset position
  doc.moveDown(3);
};

const drawCompanyInfo = (doc, companyInfo) => {
  doc.font(FONTS.bold)
    .fontSize(STYLES.header.fontSize)
    .fillColor(COLORS.dark)
    .text(companyInfo.name);
  
  doc.font(FONTS.regular)
    .fontSize(STYLES.body.fontSize)
    .fillColor(COLORS.text)
    .text(companyInfo.address)
    .text(companyInfo.contact);
  
  doc.moveDown();
};

const drawCustomerInfo = (doc, customerInfo, label = 'Bill To:') => {
  doc.font(FONTS.bold)
    .fontSize(STYLES.header.fontSize)
    .fillColor(COLORS.dark)
    .text(label);
  
  doc.font(FONTS.regular)
    .fontSize(STYLES.body.fontSize)
    .fillColor(COLORS.text)
    .text(customerInfo.name)
    .text(customerInfo.email)
    .text(customerInfo.contact);
  
  doc.moveDown();
};

const drawTable = (doc, items, startX = 50, startY) => {
  const tableTop = startY || doc.y;
  const itemNameX = startX;
  const quantityX = startX + 200;
  const priceX = startX + 300;
  const totalX = startX + 400;
  const lineHeight = 20;

  // Draw table header
  doc.font(FONTS.bold)
    .fontSize(STYLES.header.fontSize)
    .fillColor(COLORS.dark);
  
  doc.text('Item', itemNameX, tableTop);
  doc.text('Quantity', quantityX, tableTop);
  doc.text('Price', priceX, tableTop);
  doc.text('Total', totalX, tableTop);

  // Draw table rows
  doc.font(FONTS.regular)
    .fontSize(STYLES.body.fontSize)
    .fillColor(COLORS.text);

  let currentY = tableTop + lineHeight;
  
  items.forEach((item) => {
    doc.text(item.name, itemNameX, currentY);
    doc.text(item.quantity.toString(), quantityX, currentY);
    doc.text(`$${item.price.toFixed(2)}`, priceX, currentY);
    doc.text(`$${(item.price * item.quantity).toFixed(2)}`, totalX, currentY);
    currentY += lineHeight;
  });

  return currentY;
};

const drawTotals = (doc, subtotal, tax, total, startX = 300, startY) => {
  const lineHeight = 20;
  let currentY = startY || doc.y;

  doc.font(FONTS.bold)
    .fontSize(STYLES.body.fontSize)
    .fillColor(COLORS.dark);

  doc.text(`Subtotal: $${subtotal.toFixed(2)}`, startX, currentY);
  currentY += lineHeight;
  doc.text(`Tax: $${tax.toFixed(2)}`, startX, currentY);
  currentY += lineHeight;
  doc.text(`Total: $${total.toFixed(2)}`, startX, currentY);
  currentY += lineHeight * 2;

  return currentY;
};

const drawFooter = (doc, text) => {
  const bottom = doc.page.height - 50;
  
  doc.font(FONTS.regular)
    .fontSize(STYLES.small.fontSize)
    .fillColor(COLORS.text)
    .text(text, 50, bottom, { align: 'center' });
};

module.exports = {
  COLORS,
  FONTS,
  STYLES,
  drawHeader,
  drawCompanyInfo,
  drawCustomerInfo,
  drawTable,
  drawTotals,
  drawFooter,
}; 