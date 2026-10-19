# Event Management Backend

Backend Service for an Event management company built with Node.js, PostgreSQL (via Supabase), and Swagger for API documentation.

## Features

- User authentication and authorization
- Event management (CRUD operations)
- Ticket booking and management
- Swagger API documentation
- Comprehensive error handling
- Database migrations
- Testing setup with Jest
- Code quality tools (ESLint, Prettier)

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- Supabase account

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd event_management_backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add the following environment variables:
```
PORT=3000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
JWT_SECRET=your_jwt_secret
```

4. Run database migrations:
```bash
npm run migrate
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Testing

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## API Documentation

Once the server is running, you can access the Swagger documentation at:
```
http://localhost:3000/api-docs
```

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── db/            # Database setup and migrations
├── middleware/    # Custom middleware
├── models/        # Database models
├── routes/        # API routes
├── tests/         # Test files
├── utils/         # Utility functions
└── app.js         # Application entry point
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Developer

Guna Sundar D (aka CodeCapo)  
Shopify Expert, Full Stack Dev  
connect@guna.dev  
https://guna.dev  

## License

This project is licensed under the MIT License - see the LICENSE file for details. 