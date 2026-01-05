import React, { useState, useEffect } from "react";
import {
  RefreshCcw,
  Search,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  CheckCircle,
  Copy,
} from "lucide-react";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits, encodeFunctionData, stringToHex } from "viem";
import EventCard from "./EventCard";
import Modal from "./Modal";
import "./Home.css";
import "./Modal.css";
import { getApiUrl } from "../config";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ERC20 transfer ABI
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
] as const;

// API response interface
interface FortuneResult {
  status: string;
  uuid: string;
  title: string;
  description: string;
  clob_liquidity: number;
  created_at: number;
  updated_at: number;
  outcomes: Array<{
    outcome_id: string;
    name: string;
    probability: number;
  }>;
  polymarket_url: string;
  verified_payment?: {
    reference: string;
    tx_signature: string;
    verified_at: number;
  };
}

interface Event {
  uuid: string;
  title: string;
  category: string;
  clob_liquidity: number;
  volume: number;
  status: string;
  end_date: number;
  timestamp: number;
}

// Helper to save payment result to localStorage for 24h
const savePaymentResult = (uuid: string, data: any) => {
  const payload = {
    timestamp: Date.now(),
    data: data,
  };
  localStorage.setItem(`fortune_payment_${uuid}`, JSON.stringify(payload));
};

// Helper to get payment result if valid
const getPaymentResult = (uuid: string) => {
  const stored = localStorage.getItem(`fortune_payment_${uuid}`);
  if (!stored) return null;

  try {
    const { timestamp, data } = JSON.parse(stored);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp < ONE_DAY_MS) {
      return data;
    } else {
      localStorage.removeItem(`fortune_payment_${uuid}`);
      return null;
    }
  } catch (e) {
    localStorage.removeItem(`fortune_payment_${uuid}`);
    return null;
  }
};

const COLORS = [
  "#FF8C00",
  "#FF4500",
  "#FFD700",
  "#ADFF2F",
  "#00FA9A",
  "#00CED1",
  "#1E90FF",
  "#BA55D3",
  "#FF1493",
  "#DC143C",
  "#F4A460",
  "#DA70D6",
  "#87CEEB",
  "#32CD32",
  "#FF69B4",
  "#CD5C5C",
  "#4B0082",
  "#808000",
  "#008080",
  "#4682B4",
];

// Helper to prepare chart data (showing all outcomes sorted)
const prepareChartData = (outcomes: any[]) => {
  if (!outcomes) return [];
  return [...outcomes]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 10)
    .map((o) => ({
      name: o.name,
      value: o.probability * 100,
    }));
};

const CustomLineDot = (props: any) => {
  const { cx, cy, index } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={COLORS[index % COLORS.length]}
      stroke="#1a1b23"
      strokeWidth={2}
    />
  );
};

const Home: React.FC = () => {
  // Wallet hooks
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const publicClient = usePublicClient();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Payment state
  const [currentEventUuid, setCurrentEventUuid] = useState<string>("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Payment step tracking: 'idle' | 'sending' | 'verifying' | 'success'
  const [paymentStep, setPaymentStep] = useState<
    "idle" | "sending" | "verifying" | "success"
  >("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string>("");

  // Result page state
  const [showResultPage, setShowResultPage] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");
  const [fortuneResult, setFortuneResult] = useState<FortuneResult | null>(
    null
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

  const chartData = React.useMemo(() => {
    return prepareChartData(fortuneResult?.outcomes || []);
  }, [fortuneResult]);

  // Extract unique categories from events
  const categories = ["All", ...new Set(events.map((e) => e.category))];

  // Filter events based on selected category AND search query
  const filteredEvents = events.filter((e) => {
    const matchesCategory =
      selectedCategory === "All" || e.category === selectedCategory;
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;

    const connectToStream = () => {
      try {
        setLoading(true);
        setError(null);

        // Create EventSource connection for SSE
        eventSource = new EventSource(
          getApiUrl("/event/stream?network=testnet")
        );

        eventSource.onopen = () => {
          setIsLive(true);
          setLoading(false);
        };

        // Listen for the named 'event' event type (not unnamed messages)
        eventSource.addEventListener("event", (event) => {
          try {
            const data = JSON.parse(event.data);

            // Handle both single object and array responses
            if (Array.isArray(data)) {
              setEvents(data);
            } else {
              // Add new event to the list or update existing
              setEvents((prevEvents) => {
                const existingIndex = prevEvents.findIndex(
                  (e) => e.uuid === data.uuid
                );
                if (existingIndex >= 0) {
                  // Update existing event
                  const newEvents = [...prevEvents];
                  newEvents[existingIndex] = data;
                  return newEvents;
                } else {
                  // Add new event
                  return [...prevEvents, data];
                }
              });
            }

            setIsLive(true);
            setLoading(false);
          } catch (parseError) {
            console.error("Error parsing event data:", parseError);
          }
        });

        eventSource.onerror = (err) => {
          console.error("EventSource error:", err);
          setIsLive(false);

          if (eventSource?.readyState === EventSource.CLOSED) {
            setError("Connection to event stream closed");
            setLoading(false);

            // Attempt to reconnect after 5 seconds
            reconnectTimeout = setTimeout(() => {
              connectToStream();
            }, 5000);
          }
        };
      } catch (err) {
        console.error("Error connecting to stream:", err);
        setError(
          err instanceof Error ? err.message : "Failed to connect to stream"
        );
        setLoading(false);
        setIsLive(false);
      }
    };

    connectToStream();

    // Cleanup function
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []);

  const refreshConnection = () => {
    // Force a page reload to restart the connection
    window.location.reload();
  };

  const handleUnlock = async (uuid: string, title: string) => {
    // Check locally first
    const cachedResult = getPaymentResult(uuid);
    if (cachedResult) {
      setFortuneResult(cachedResult);
      setShowResultPage(true);
      return;
    }

    setModalTitle(title);
    setIsModalOpen(true);
    setModalLoading(true);
    setModalContent(null);
    setCurrentEventUuid(uuid);
    setPaymentError(null);

    try {
      const response = await fetch(getApiUrl(`/event/${uuid}?network=testnet`));
      const data = await response.json();

      if (response.status === 402) {
        // Payment required
        setModalContent(data);
      } else if (!response.ok) {
        throw new Error(data.message || "Failed to fetch event details");
      } else {
        // Success
        setModalContent(data);
      }
    } catch (err) {
      setModalContent({
        error: err instanceof Error ? err.message : "An unknown error occurred",
      });
    } finally {
      setModalLoading(false);
    }
  };

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    if (!walletClient || !address || !modalContent?.invoice) {
      setPaymentError("Please connect your wallet first");
      return;
    }

    const { receiver_address, amount_usdc, reference, contract_address } =
      modalContent.invoice;

    setPaymentProcessing(true);
    setPaymentError(null);
    setPaymentStep("sending");
    setTxHash(null);

    try {
      // Validate contract address from API
      if (!contract_address) {
        throw new Error("Contract address not provided by server");
      }

      console.log("Initiating payment:", {
        contract_address,
        receiver_address,
        amount_usdc,
        payer: address,
      });

      // Fetch token decimals dynamically
      let decimals = 6;
      if (publicClient) {
        try {
          // Read transaction might fail if ABI doesn't match or network issues, default to 6
          const fetchedDecimals = await publicClient.readContract({
            address: contract_address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "decimals",
          });
          decimals = Number(fetchedDecimals);
          console.log(`Fetched token decimals: ${decimals}`);
        } catch (decimalErr) {
          console.warn(
            "Failed to fetch decimals, defaulting to 6:",
            decimalErr
          );
        }
      }

      // Parse amount with correct decimals
      const amount = parseUnits(amount_usdc.toString(), decimals);

      // 1. Encode base transfer data
      const transferData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [receiver_address as `0x${string}`, amount],
      });

      // 2. Encode reference to hex
      // stringToHex returns "0x...", we need to remove the prefix for concatenation
      // except the first one. transferData already has 0x.
      const referenceHex = stringToHex(reference);

      // 3. Append reference to data (remove 0x from referenceHex)
      const finalData = `${transferData}${referenceHex.slice(
        2
      )}` as `0x${string}`;

      console.log("Encoded Data:", {
        transferData,
        referenceHex,
        finalData,
      });

      // 4. Send transaction using sendTransaction instead of writeContract
      const transactionHash = await walletClient.sendTransaction({
        to: contract_address as `0x${string}`,
        data: finalData,
        value: 0n, // ERC20 transfer, so native value is 0
        account: address,
        gas: 300000n, // Explicit gas limit to avoid estimation errors with extra data
      });

      console.log("Transaction sent:", transactionHash);

      // Ensure signature has 0x prefix
      const txSignature = transactionHash.startsWith("0x")
        ? transactionHash
        : `0x${transactionHash}`;
      setTxHash(txSignature);
      setPaymentStep("verifying");
      setVerificationMessage("Waiting for blockchain confirmation...");

      // Wait for transaction confirmation
      if (publicClient) {
        console.log("Waiting for transaction confirmation...");
        await publicClient.waitForTransactionReceipt({
          hash: transactionHash,
          confirmations: 1, // Wait for at least 1 confirmation
        });
        console.log("Transaction confirmed!");

        // Add a small delay to ensure backend indexer has caught up (similar to script's 5s wait)
        setVerificationMessage("Waiting for system processing...");
        console.log("Waiting for backend indexing...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } else {
        // Fallback if publicClient is missing (shouldn't happen with wagmi setup)
        console.warn("Public client missing, waiting 10s blind...");
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }

      setVerificationMessage("Verifying payment details...");

      // Call the API with payment details
      const verifyResponse = await fetch(
        getApiUrl(`/event/${currentEventUuid}?network=testnet`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reference: reference,
            tx_signature: txSignature,
            payer_address: address,
          }),
        }
      );

      const result = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(result.message || "Payment verification failed");
      }

      // Set success state and store result
      setPaymentStep("success");
      setFortuneResult(result);
      savePaymentResult(currentEventUuid, result);
    } catch (err: any) {
      console.error("Payment error details:", err);
      setPaymentStep("idle");

      // More descriptive error messages
      let errorMessage = "Payment failed. Please try again.";
      if (err.message && err.message.includes("User rejected")) {
        errorMessage = "Transaction rejected by user.";
      } else if (err.message && err.message.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas or payment amount.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setPaymentError(errorMessage);
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Close payment modal and show result
  const handleClosePaymentModal = () => {
    setIsModalOpen(false);
    if (paymentStep === "success" && fortuneResult) {
      setShowResultPage(true);
    }
    // Reset payment states
    setPaymentStep("idle");
    setTxHash(null);
    setPaymentError(null);
  };

  // Go back from result page
  const handleBackToHome = () => {
    setShowResultPage(false);
    setFortuneResult(null);
  };

  // Countdown timer for invoice expiration
  useEffect(() => {
    if (!isModalOpen || !modalContent?.invoice?.expires_at) return;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = modalContent.invoice.expires_at - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
      } else {
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [isModalOpen, modalContent]);

  // Handle scroll for "Back to Top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Result page view

  return (
    <>
      <div className="gradient-bg"></div>
      <div className="home-container">
        <header className="header">
          <div className="header-content">
            <div className="logo-section">
              <h1 className="logo">Fortune</h1>
              <div className={`live-indicator ${isLive ? "active" : ""}`}>
                <span className="pulse-dot"></span>
                <span className="live-text">Live</span>
              </div>
            </div>

            <div className="navbar-search">
              <div className="search-wrapper">
                <Search className="search-icon" size={16} />
                <input
                  type="text"
                  placeholder="Search prediction markets..."
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="header-actions">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  authenticationStatus,
                  mounted,
                }) => {
                  const ready = mounted && authenticationStatus !== "loading";
                  const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                      authenticationStatus === "authenticated");

                  return (
                    <div
                      {...(!ready && {
                        "aria-hidden": true,
                        style: {
                          opacity: 0,
                          pointerEvents: "none",
                          userSelect: "none",
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <button
                              onClick={openConnectModal}
                              type="button"
                              className="connect-wallet-btn"
                            >
                              Connect Wallet
                            </button>
                          );
                        }

                        if (chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              type="button"
                              className="connect-wallet-btn unsupported"
                            >
                              Wrong network
                            </button>
                          );
                        }

                        return (
                          <div style={{ display: "flex", gap: 12 }}>
                            <button
                              onClick={openChainModal}
                              style={{ display: "flex", alignItems: "center" }}
                              type="button"
                              className="chain-select-btn"
                            >
                              {chain.hasIcon && (
                                <div
                                  className="chain-icon-wrapper"
                                  style={{
                                    background: chain.iconBackground,
                                    width: 18,
                                    height: 18,
                                    borderRadius: 999,
                                    overflow: "hidden",
                                  }}
                                >
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? "Chain icon"}
                                      src={chain.iconUrl}
                                      style={{ width: 18, height: 18 }}
                                    />
                                  )}
                                </div>
                              )}
                              <span className="chain-name">{chain.name}</span>
                            </button>

                            <button
                              onClick={openAccountModal}
                              type="button"
                              className="account-details-btn"
                            >
                              {account.displayName}
                              {account.displayBalance &&
                              !account.displayBalance.includes("NaN")
                                ? ` (${account.displayBalance})`
                                : ""}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div className="page-header">
            <div className="title-row">
              <h2 className="page-title">
                Prediction <span className="gradient-text">Markets</span>
              </h2>
              <div className="header-controls">
                <div className="market-count-badge">
                  {events.length} Active Markets
                </div>
                <button
                  className="refresh-icon-btn"
                  onClick={refreshConnection}
                  title="Refresh Events"
                >
                  <RefreshCcw size={18} />
                </button>
              </div>
            </div>
            <div className="categories-container">
              <div className="categories-filter">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`category-tag ${
                      selectedCategory === cat ? "active" : ""
                    }`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {/* <p className="page-subtitle">
              Explore active prediction markets and place your bets on future
              outcomes
            </p> */}
          </div>

          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p className="loading-text">Loading events...</p>
            </div>
          )}

          {error && (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h3 className="error-title">Failed to Load Events</h3>
              <p className="error-message">{error}</p>
              <button className="primary" onClick={refreshConnection}>
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="empty-container">
              <div className="empty-icon">📊</div>
              <h3 className="empty-title">No Events Available</h3>
              <p className="empty-message">
                Check back later for new prediction markets
              </p>
            </div>
          )}

          {!loading && !error && filteredEvents.length > 0 && (
            <div className="events-grid">
              {filteredEvents.map((event, index) => (
                <div
                  key={event.uuid}
                  className="event-card-wrapper"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <EventCard
                    {...event}
                    onUnlock={handleUnlock}
                    isUnlocked={!!getPaymentResult(event.uuid)}
                  />
                </div>
              ))}
            </div>
          )}
        </main>

        <footer className="footer">
          <div className="footer-content">
            <h2 className="footer-logo">Fortune</h2>
            <p className="footer-text">
              &copy; {new Date().getFullYear()} Fortune. All rights reserved.
            </p>
          </div>
        </footer>

        <Modal
          isOpen={isModalOpen}
          onClose={handleClosePaymentModal}
          title={modalTitle}
        >
          {modalLoading ? (
            <div className="modal-loading">
              <div className="loading-spinner small"></div>
              <p>Fetching market data...</p>
            </div>
          ) : paymentStep !== "idle" ? (
            // Payment in progress or completed
            <div className="payment-progress">
              {paymentStep === "sending" && (
                <div className="payment-step-content">
                  <div className="payment-step-icon sending">
                    <div className="loading-spinner medium"></div>
                  </div>
                  <h3 className="payment-step-title">Sending Payment...</h3>
                  <p className="payment-step-description">
                    Please confirm the transaction in your wallet
                  </p>
                </div>
              )}

              {paymentStep === "verifying" && (
                <div className="payment-step-content">
                  <div className="payment-step-icon verifying">
                    <div className="loading-spinner medium"></div>
                  </div>
                  <h3 className="payment-step-title">Verifying Payment...</h3>
                  <p className="payment-step-description">
                    {verificationMessage ||
                      "Confirming your transaction on the blockchain"}
                  </p>
                  {txHash && (
                    <div className="tx-hash-display">
                      <span className="tx-label">Transaction Hash:</span>
                      <span className="tx-value">
                        {txHash.slice(0, 8)}...{txHash.slice(-8)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(txHash)}
                        title="Copy Transaction Hash"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {paymentStep === "success" && (
                <div className="payment-step-content success">
                  <div className="payment-step-icon success-icon">
                    <CheckCircle size={48} />
                  </div>
                  <h3 className="payment-step-title">Payment Successful!</h3>
                  <p className="payment-step-description">
                    Your payment has been verified
                  </p>
                  {txHash && (
                    <div className="tx-hash-display">
                      <span className="tx-label">Transaction Hash:</span>
                      <span className="tx-value">
                        {txHash.slice(0, 10)}...{txHash.slice(-8)}
                      </span>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(txHash)}
                        title="Copy Transaction Hash"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                  <button
                    className="view-result-btn"
                    onClick={handleClosePaymentModal}
                  >
                    View Fortune Results
                  </button>
                </div>
              )}
            </div>
          ) : modalContent?.status === "payment_required" ? (
            <div className="payment-invoice">
              <div className="invoice-header">
                <h3>{modalContent.message}</h3>
                <p className="invoice-subtitle">
                  Please complete the payment to see the prediction
                </p>
              </div>

              <div className="invoice-details">
                <div className="invoice-row">
                  <span className="invoice-label">Amount</span>
                  <span className="invoice-value highlight">
                    {modalContent.invoice.amount_usdc}{" "}
                    {modalContent.invoice.currency}
                  </span>
                </div>
                <div className="invoice-row">
                  <span className="invoice-label">Network</span>
                  <span className="invoice-value">
                    {modalContent.invoice.network}
                  </span>
                </div>
                <div className="invoice-row">
                  <span className="invoice-label">Recipient</span>
                  <span
                    className="invoice-value address"
                    title={modalContent.invoice.receiver_address}
                  >
                    {modalContent.invoice.receiver_address}
                  </span>
                </div>
                <div className="invoice-row">
                  <span className="invoice-label">Reference</span>
                  <span className="invoice-value">
                    {modalContent.invoice.reference}
                  </span>
                </div>
              </div>

              {paymentError && (
                <div className="payment-error-container">
                  <div className="payment-error centered">
                    <span className="error-icon">⚠️</span>
                    <span>{paymentError}</span>
                  </div>
                </div>
              )}

              {paymentError && txHash && (
                <div className="error-tx-hash-inline">
                  <span className="tx-label">Transaction Hash:</span>
                  <div className="tx-value-group">
                    <span className="tx-value-short">
                      {txHash.slice(0, 25)}...{txHash.slice(-25)}
                    </span>
                    <button
                      className="copy-btn"
                      onClick={() => navigator.clipboard.writeText(txHash)}
                      title="Copy Transaction Hash"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}

              {!isConnected ? (
                <button
                  className="connect-wallet-message-btn"
                  onClick={openConnectModal}
                >
                  Connect Wallet to Make Payment
                </button>
              ) : (
                <button
                  className="confirm-pay-btn"
                  onClick={handleConfirmPayment}
                  disabled={paymentProcessing || timeLeft === "Expired"}
                >
                  {timeLeft === "Expired"
                    ? "Invoice Expired"
                    : "Confirm Payment"}
                </button>
              )}

              <p className="invoice-footer">
                Invoice expires in{" "}
                <span className="timer-highlight">{timeLeft}</span>
              </p>
            </div>
          ) : (
            <div className="modal-data">
              <pre className="json-display">
                {JSON.stringify(modalContent, null, 2)}
              </pre>
            </div>
          )}
        </Modal>

        <button
          className={`scroll-to-top ${showScrollTop ? "show" : ""}`}
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <ArrowUp size={24} />
        </button>

        {/* Result Overlay */}
        <div
          className={`result-backdrop ${showResultPage ? "open" : ""}`}
          onClick={handleBackToHome}
        ></div>

        <div className={`result-overlay ${showResultPage ? "open" : ""}`}>
          {fortuneResult && (
            <div className="result-page">
              <button className="back-button" onClick={handleBackToHome}>
                <ArrowLeft size={20} />
                Back to Markets
              </button>

              <div className="result-header">
                <div className="result-status">
                  <CheckCircle size={24} className="success-icon" />
                  <span>Payment Verified</span>
                </div>
                <h1 className="result-title">{fortuneResult.title}</h1>
              </div>

              <div className="result-content">
                <div className="result-card">
                  <h2 className="section-title">Market Description</h2>
                  <p className="description-text">
                    {fortuneResult.description}
                  </p>
                </div>

                <div className="result-card">
                  <h2 className="section-title">Market Statistics</h2>
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">Liquidity</span>
                      <span className="stat-value">
                        $
                        {fortuneResult.clob_liquidity?.toLocaleString() ??
                          "N/A"}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Created</span>
                      <span className="stat-value">
                        {fortuneResult.created_at
                          ? new Date(
                              fortuneResult.created_at * 1000
                            ).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Last Updated</span>
                      <span className="stat-value">
                        {fortuneResult.updated_at
                          ? new Date(
                              fortuneResult.updated_at * 1000
                            ).toLocaleString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="result-card">
                  <h2 className="section-title">Outcomes & Probabilities</h2>

                  <div className="chart-controls">
                    <button
                      className={`chart-btn ${
                        chartType === "bar" ? "active" : ""
                      }`}
                      onClick={() => setChartType("bar")}
                    >
                      Bar
                    </button>
                    <button
                      className={`chart-btn ${
                        chartType === "line" ? "active" : ""
                      }`}
                      onClick={() => setChartType("line")}
                    >
                      Line
                    </button>
                    <button
                      className={`chart-btn ${
                        chartType === "pie" ? "active" : ""
                      }`}
                      onClick={() => setChartType("pie")}
                    >
                      Pie
                    </button>
                  </div>

                  {chartType === "line" && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "15px",
                        marginBottom: "20px",
                        justifyContent: "center",
                        padding: "0 10px",
                      }}
                    >
                      {chartData.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.8em",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          ></span>
                          <span style={{ color: "rgba(255,255,255,0.7)" }}>
                            {item.name}
                          </span>
                          <span
                            style={{
                              color: COLORS[index % COLORS.length],
                              fontWeight: "bold",
                            }}
                          >
                            {Math.round(item.value)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === "bar" ? (
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                        >
                          <XAxis
                            type="category"
                            dataKey="name"
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            tick={{
                              fill: "rgba(255,255,255,0.7)",
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{
                              fill: "rgba(255,255,255,0.7)",
                              fontSize: 11,
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1b23",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                            itemStyle={{ color: "#ff8c00" }}
                            formatter={(value: any) => [
                              `${Number(value).toFixed(2)}%`,
                              "Probability",
                            ]}
                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                          />
                          <Bar
                            dataKey="value"
                            fill="#ff8c00"
                            radius={[4, 4, 0, 0]}
                          >
                            {chartData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fillOpacity={0.8 + index * 0.02}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : chartType === "line" ? (
                        <LineChart
                          data={chartData}
                          margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(255,255,255,0.1)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            interval={0}
                            angle={-45}
                            textAnchor="end"
                            tick={{
                              fill: "rgba(255,255,255,0.7)",
                              fontSize: 11,
                            }}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{
                              fill: "rgba(255,255,255,0.7)",
                              fontSize: 11,
                            }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1b23",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                            itemStyle={{ color: "#ff8c00" }}
                            formatter={(value: any) => [
                              `${Number(value).toFixed(2)}%`,
                              "Probability",
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth={2}
                            dot={<CustomLineDot />}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </LineChart>
                      ) : (
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                          >
                            {chartData.map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1a1b23",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "8px",
                              color: "#fff",
                            }}
                            itemStyle={{ color: "#fff" }}
                            formatter={(value: any, name: any) => [
                              `${Number(value).toFixed(2)}%`,
                              name,
                            ]}
                          />
                          <Legend />
                        </PieChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  <div className="outcomes-list">
                    {fortuneResult.outcomes
                      ?.sort((a, b) => b.probability - a.probability)
                      ?.map((outcome) => (
                        <div key={outcome.outcome_id} className="outcome-item">
                          <div className="outcome-header">
                            <span className="outcome-name">{outcome.name}</span>
                            <span className="outcome-probability">
                              {(outcome.probability * 100).toFixed(2)}%
                            </span>
                          </div>
                          <div className="probability-bar">
                            <div
                              className="probability-fill"
                              style={{ width: `${outcome.probability * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {fortuneResult.polymarket_url && (
                  <a
                    href={fortuneResult.polymarket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="polymarket-link"
                  >
                    <ExternalLink size={18} />
                    View on Polymarket
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Home;
