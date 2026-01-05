import React from "react";
import "./EventCard.css";

interface EventCardProps {
  uuid: string;
  title: string;
  category: string;
  clob_liquidity: number;
  volume: number;
  status: string;
  end_date: number;
  timestamp: number;
  onUnlock?: (uuid: string, title: string) => void;
  isUnlocked?: boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  uuid,
  title,
  category,
  clob_liquidity,
  volume,
  status,
  end_date,
  timestamp,
  onUnlock,
  isUnlocked,
}) => {
  // Format numbers with commas and decimals
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Format large numbers with K/M suffix
  const formatLargeNumber = (num: number): string => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  // Calculate time remaining
  const getTimeRemaining = (): string => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = end_date - now;

    if (remaining < 0) return "Ended";

    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Get status badge class
  const getStatusClass = (): string => {
    switch (status.toLowerCase()) {
      case "active":
        return "status-active";
      case "pending":
        return "status-pending";
      default:
        return "status-inactive";
    }
  };

  return (
    <div className="event-card">
      <div className="card-header">
        <div className="title-section">
          <h3 className="card-title">{title}</h3>
          <span className="card-category">{category}</span>
        </div>
        <div className="status-section">
          <span className={`status-badge ${getStatusClass()}`}>{status}</span>
          <span className="active-since-label">
            since{" "}
            {new Date(timestamp * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      <div className="card-metrics">
        <div className="metric-group">
          <div className="metric-item">
            <span className="metric-label">Liquidity</span>
            <span className="metric-value">
              {formatLargeNumber(clob_liquidity)}
            </span>
            <span className="metric-detail">
              {formatNumber(clob_liquidity)}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Volume</span>
            <span className="metric-value">{formatLargeNumber(volume)}</span>
            <span className="metric-detail">{formatNumber(volume)}</span>
          </div>
        </div>
      </div>

      <div className="card-footer">
        <div className="footer-row">
          <div className="footer-item">
            <span className="footer-label">Time Remaining</span>
            <span className="footer-value">{getTimeRemaining()}</span>
          </div>
          <div className="footer-item">
            <span className="footer-label">Ends</span>
            <span className="footer-value">
              {new Date(end_date * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <button
          className={`pay-unlock-btn ${isUnlocked ? "view-details" : ""}`}
          onClick={() => onUnlock?.(uuid, title)}
        >
          {isUnlocked ? "View Details" : "Pay to Unlock"}
        </button>
      </div>
    </div>
  );
};

export default EventCard;
