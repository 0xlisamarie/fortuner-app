# Fortune App

A modern Web3-enabled prediction market explorer that provides real-time insights into Polymarket events with seamless blockchain payment integration.

## 🌟 Features

### Core Functionality

- **Real-time Market Discovery**: Browse active prediction markets with live updates via Server-Sent Events (SSE)
- **Advanced Search & Filtering**: Search by title or category, filter markets by category tags
- **Detailed Market Analytics**: View comprehensive market statistics including:
  - Market liquidity and volume
  - Outcome probabilities
  - Creation and update timestamps
  - Interactive data visualizations (Bar, Line, Pie charts)

### Web3 Integration

- **Wallet Connection**: Seamless integration with popular Web3 wallets via RainbowKit
- **Multi-Network Support**: Compatible with multiple blockchain networks
- **USDC Payments**: Pay to unlock detailed market predictions using USDC
- **Transaction Verification**: On-chain payment verification with real-time status updates
- **Payment Caching**: 24-hour local storage of unlocked predictions

### User Experience

- **Responsive Design**: Fully mobile-responsive with optimized layouts
- **Dark Theme**: Beautiful dark-themed interface with orange gradient accents
- **Result Overlay**: Side panel overlay for viewing unlocked predictions without losing context
- **Scroll-to-Top**: Convenient navigation button for long market lists
- **Live Status Indicator**: Real-time connection status with visual feedback
- **Loading States**: Smooth loading animations and error handling

## 🛠 Tech Stack

### Frontend Framework

- **React 19.2.0** - Modern React with latest features
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool and dev server

### Web3 & Blockchain

- **RainbowKit 2.2.10** - Wallet connection UI
- **Wagmi 3.1.4** - React hooks for Ethereum
- **Viem 2.43.5** - TypeScript interface for Ethereum
- **TanStack Query 5.90.16** - Async state management

### UI & Styling

- **Vanilla CSS** - Custom styling for maximum control
- **Lucide React** - Modern icon library
- **Recharts 3.6.0** - Data visualization library

### Development Tools

- **ESLint** - Code linting
- **TypeScript ESLint** - TypeScript-specific linting
- **SWC** - Fast TypeScript/JSX compilation

## 📦 Installation

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Setup Instructions

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Fortune-App
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Start the development server**

   ```bash
   pnpm run dev
   ```

   The app will be available at `http://localhost:5173`

4. **Build for production**

   ```bash
   pnpm run build
   ```

5. **Preview production build**
   ```bash
   pnpm run preview
   ```

## 🏗 Project Structure

```
Fortune-App/
├── src/
│   ├── components/
│   │   ├── Home.tsx              # Main application component
│   │   ├── Home.css              # Main component styles
│   │   ├── EventCard.tsx         # Market card component
│   │   ├── EventCard.css         # Card styles
│   │   ├── Modal.tsx             # Payment modal component
│   │   └── Modal.css             # Modal styles
│   ├── lib/
│   │   └── web3.ts               # Web3 configuration
│   ├── App.tsx                   # App wrapper
│   ├── App.css                   # Global app styles
│   └── main.tsx                  # Application entry point
├── public/                        # Static assets
├── index.html                     # HTML template
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Project dependencies
```

## 📱 Key Components

### Home Component

The main application component that handles:

- SSE connection for real-time updates
- Market state management
- Search and filtering logic
- Wallet integration
- Payment flow orchestration

### EventCard Component

Reusable card component displaying:

- Market title and category
- Liquidity and volume metrics
- Time to expiration
- Unlock/View Details actions

### Modal Component

Payment modal handling:

- Payment invoice display
- USDC transfer execution
- Transaction verification
- Success/error states

## 🔐 Payment Flow

1. **User clicks "Pay to Unlock"** on a market card
2. **Invoice fetched** from backend API
3. **Payment details displayed** in modal:
   - USDC amount
   - Recipient address
   - Network information
   - Countdown timer
4. **User confirms payment** via wallet
5. **Transaction submitted** to blockchain
6. **Backend verifies** payment on-chain
7. **Prediction data unlocked** and displayed in overlay
8. **Results cached** locally for 24 hours

## 📊 Data Visualization

The app includes three chart types for outcome probabilities:

- **Bar Chart**: Compare outcomes side-by-side with horizontal labels
- **Line Chart**: Track probability trends with custom dot styling and grid
- **Pie Chart**: Visual distribution with distinct colors and legend

Charts display the top 10 outcomes sorted by probability, with all data available in the detailed list below.

## 🎨 UI Highlights

### Mobile Responsive Header

- Logo and live indicator stack vertically
- Wallet connection buttons move to the right
- Search bar takes full width on second row
- Chain name hidden on mobile (icon only)

### Result Overlay

- Slides in from the right (max-width: 800px)
- Blurred backdrop for focus
- Scrollable content area
- Persistent back button
- Full market details and statistics

### Footer

- Fortune branding with gradient logo
- Dynamic copyright year
- Clean, centered layout

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
# Add your environment-specific variables here
```

### Web3 Configuration

Update `src/lib/web3.ts` with your:

- Supported networks
- RainbowKit project ID
- Custom chain configurations

## 🚀 Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build
- `pnpm lint` - Run ESLint

## 🎯 Future Enhancements

- [ ] User portfolio tracking
- [ ] Market watchlist
- [ ] Push notifications
- [ ] Historical data analytics
- [ ] Social sharing features
- [ ] Multi-language support

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For support, please open an issue in the repository or contact the development team.

---

**Built with ❤️ using React, TypeScript, and Web3**
