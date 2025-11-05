# Palliative Care Mobile App

React Native + Expo mobile application for the Palliative Care Healthcare Management System.

## Features

- ✅ User Authentication (Patient, Doctor, Nurse)
- ✅ Medication Management
- ✅ Prescription Accept/Reject
- ✅ User Profile
- 🚧 Appointments (Coming Soon)
- 🚧 Chat (Coming Soon)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Expo Go app (for testing on physical device)
- Android Studio (for Android emulator) or Xcode (for iOS simulator - Mac only)

## Setup Instructions

### 1. Install Dependencies

```bash
cd project-app
npm install
```

### 2. Configure Environment Variables

Create or edit `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your Supabase project settings:
1. Go to https://supabase.com
2. Open your project
3. Go to Settings → API
4. Copy the Project URL and anon/public key

### 3. Run the App

```bash
# Start the development server
npm start

# Or run on specific platform
npm run android  # Android emulator or device
npm run ios      # iOS simulator (Mac only)
npm run web      # Web browser
```

### 4. Test on Physical Device

1. Install **Expo Go** app from Play Store (Android) or App Store (iOS)
2. Scan the QR code from the terminal/browser
3. The app will load on your device

## Project Structure

```
project-app/
├── App.tsx                 # Main app entry point with navigation
├── context/
│   └── AuthContext.tsx     # Authentication context provider
├── lib/
│   └── supabase.ts         # Supabase client configuration
├── screens/
│   ├── LoginScreen.tsx     # Login screen
│   ├── SignupScreen.tsx    # Signup screen
│   ├── HomeScreen.tsx      # Home dashboard
│   ├── MedicationsScreen.tsx  # Medications/Prescriptions
│   └── ProfileScreen.tsx   # User profile
├── types/
│   └── navigation.ts       # TypeScript navigation types
└── .env                    # Environment variables (create this)
```

## Features Overview

### Authentication
- Login as Patient, Doctor, or Nurse
- Signup for new accounts
- Secure session management with AsyncStorage
- Automatic session persistence

### Medications (Patient View)
- View all prescriptions
- Accept pending prescriptions
- Reject prescriptions with optional reason
- View medication details (dosage, frequency, dates)
- See prescription status (pending, active, cancelled)
- Pull to refresh

### Profile
- View account information
- Logout functionality
- Settings placeholder (notifications, privacy, help)

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run in web browser
- `npm run lint` - Run TypeScript linter

## API Integration

The app connects to the same Supabase backend as the web application:

- Uses RPC functions for authentication (`login_user`, `login_doctor`, `login_nurse`)
- Uses RPC functions for prescriptions (`accept_prescription`, `reject_prescription`)
- Direct Supabase queries for medication data

## Database Requirements

Ensure your Supabase database has the migration applied:
```bash
# Run this in Supabase SQL Editor
project/migration_prescription_system.sql
```

## Troubleshooting

### "Cannot find module" errors
```bash
npm install
rm -rf node_modules
npm install
```

### Expo Go not connecting
- Make sure your phone and computer are on the same WiFi network
- Try using tunnel mode: `npm start --tunnel`

### Database connection issues
- Verify .env file has correct Supabase credentials
- Check Supabase RLS policies allow anon key access
- Ensure database functions are created

### App crashes on login
- Check console for error messages
- Verify database has all required tables and functions
- Test authentication in Supabase dashboard first

## Building for Production

### Android APK
```bash
expo build:android
```

### iOS App
```bash
expo build:ios
```

Note: You'll need an Expo account (free) to build production apps.

## Next Steps

- [ ] Add appointment scheduling
- [ ] Implement real-time chat
- [ ] Add medication reminders/notifications
- [ ] Google Calendar integration
- [ ] Push notifications
- [ ] Biometric authentication
- [ ] Offline support

## Technologies Used

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation library
- **Supabase** - Backend (PostgreSQL + Auth)
- **AsyncStorage** - Local storage
- **Expo Vector Icons** - Icons
- **Expo Linear Gradient** - Gradients

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Supabase logs
3. Check React Native / Expo documentation
4. Verify database migration was run successfully

## License

Same as parent project
