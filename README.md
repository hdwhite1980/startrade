# StarTrade 🚀

A prediction market mobile app built with Expo, Supabase, and Web3.

## Features

- 📊 Browse and trade on prediction markets
- 💼 Track your portfolio and winnings
- 🏆 Compete on leaderboards
- 🔐 Secure wallet integration with Base chain
- ⚡ Real-time odds updates
- 🤖 AI-generated market suggestions

## Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI
- Supabase account
- Azure (for smart contracts, optional)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

### 3. Set Up Database

1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql` in the SQL Editor
3. Enable Realtime for the `markets` table

### 4. Run the App

```bash
npx expo start
```

Press `i` for iOS simulator or `a` for Android emulator.

## Project Structure

```
startrade/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Tab navigation
│   │   ├── index.tsx      # Markets list
│   │   ├── portfolio.tsx  # User portfolio
│   │   ├── leaderboard.tsx# Rankings
│   │   └── profile.tsx    # User profile
│   ├── market/[id].tsx    # Market detail
│   └── auth.tsx           # Authentication
├── components/            # Reusable components
│   ├── BetSlip.tsx       # Bet placement UI
│   └── Deposit.tsx       # Deposit funds UI
├── hooks/                 # Custom React hooks
│   ├── useAuth.ts        # Authentication hook
│   ├── useMarkets.ts     # Markets data hook
│   ├── useBets.ts        # Bets data hook
│   └── useWallet.ts      # Wallet hook
├── stores/                # Zustand stores
│   ├── authStore.ts      # Auth state
│   └── walletStore.ts    # Wallet state
├── lib/                   # Core utilities
│   ├── supabase.ts       # Supabase client
│   ├── wallet.ts         # Wallet functions
│   └── contracts.ts      # Smart contract ABIs
├── types/                 # TypeScript types
│   └── database.ts       # Supabase types
└── supabase/             # Supabase configs
    └── schema.sql        # Database schema
```

## Development

### Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Generating Types

After modifying your Supabase schema:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
```

## Tech Stack

- **Framework**: Expo / React Native
- **Navigation**: Expo Router
- **Styling**: NativeWind (TailwindCSS)
- **Backend**: Supabase (PostgreSQL + Realtime)
- **State**: Zustand
- **Blockchain**: ethers.js v6 + Base chain
- **Storage**: expo-secure-store

## Features Roadmap

- [x] Markets browsing
- [x] Real-time odds updates
- [x] User authentication
- [x] Portfolio tracking
- [x] Leaderboards
- [ ] Push notifications
- [ ] Beef Mode (1v1 challenges)
- [ ] Social features
- [ ] Deep linking

## License

MIT
