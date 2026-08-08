# Probation Portal API ⚡

The robust backend REST API that powers the **Next Gen Solutions Probation Portal**.
Built with Node.js, Express, and Prisma, it provides highly scalable, real-time endpoints for managing users, tasks, attendance, and push notifications.

## 🚀 Features

- **Authentication & Security:** Secure JWT-based authentication with role-based access control (ADMIN vs. USER). Passwords hashed using bcrypt.
- **Database Management:** Strongly typed database schema using Prisma ORM with SQLite (easily transferable to PostgreSQL).
- **Real-time Engine:** Integrated with **Pusher** for real-time WebSocket events (live chat, task status updates).
- **Push Notifications:** Firebase Cloud Messaging (FCM) integration via `firebase-admin` to send push notifications directly to Expo devices.
- **Email Services:** Nodemailer integration for automated email updates and alerts.
- **Comprehensive Endpoints:** 
  - User management (CRUD, domain assignment)
  - Task creation, submission workflows, and reviews
  - Real-time chat rooms for domains
  - Data export and dashboard analytics

## 🛠️ Technology Stack
- **Runtime:** Node.js
- **Framework:** Express.js (with TypeScript)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Real-time:** Pusher
- **Push Notifications:** Firebase Admin SDK
- **Database:** SQLite (default)

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- [pnpm](https://pnpm.io/)
- Firebase Service Account Key (for notifications)

### Installation

1. Clone the repository and navigate to the API directory:
   ```bash
   cd probation-portal-api
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Setup Environment Variables:
   Create a `.env` file with the following keys:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your_jwt_secret"
   PORT=3000
   PUSHER_APP_ID="your_pusher_app_id"
   PUSHER_KEY="your_pusher_key"
   PUSHER_SECRET="your_pusher_secret"
   PUSHER_CLUSTER="your_pusher_cluster"
   FIREBASE_PROJECT_ID="your_firebase_project"
   FIREBASE_CLIENT_EMAIL="your_service_account_email"
   FIREBASE_PRIVATE_KEY="your_private_key"
   ```

4. Initialize the Database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Start the Development Server:
   ```bash
   pnpm run dev
   ```

### Production Build
To build the TypeScript project for production:
```bash
pnpm run build
pnpm start
```

## 🔒 Security Notes
- Ensure your `google-services.json` and Firebase private keys are kept strictly out of version control.
- Change the `JWT_SECRET` in production environments.

## 📄 License
Internal use only. Next Gen Solutions.
