import React from 'react';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: 'dollar' | 'trending-up' | 'trending-down' | 'alert' | 'wallet';
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'neutral';
  subtitle?: string;
}

const ICON_MAP = {
  'dollar': DollarSign,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'alert': AlertTriangle,
  'wallet': Wallet,
};

const VARIANT_COLORS = {
  primary: {
    bg: '#EFF6FF',
    border: '#3B82F6',
    icon: '#3B82F6',
    text: '#1E40AF'
  },
  success: {
    bg: '#F0FDF4',
    border: '#22C55E',
    icon: '#22C55E',
    text: '#166534'
  },
  danger: {
    bg: '#FEF2F2',
    border: '#EF4444',
    icon: '#EF4444',
    text: '#991B1B'
  },
  warning: {
    bg: '#FFFBEB',
    border: '#F59E0B',
    icon: '#F59E0B',
    text: '#92400E'
  },
  neutral: {
    bg: '#F9FAFB',
    border: '#6B7280',
    icon: '#6B7280',
    text: '#374151'
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon,
  variant = 'neutral',
  subtitle 
}) => {
  const IconComponent = ICON_MAP[icon];
  const colors = VARIANT_COLORS[variant];

  return (
    <div style={{
      backgroundColor: colors.bg,
      border: `2px solid ${colors.border}`,
      borderRadius: '12px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'all 0.2s ease',
      cursor: 'default',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    }}>
      {/* Header com ícone */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: colors.text,
          letterSpacing: '0.025em'
        }}>
          {title}
        </h3>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: colors.icon + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <IconComponent 
            size={24} 
            color={colors.icon}
            strokeWidth={2.5}
          />
        </div>
      </div>

      {/* Valor */}
      <div style={{
        fontSize: '32px',
        fontWeight: '700',
        color: colors.text,
        lineHeight: '1',
        letterSpacing: '-0.02em'
      }}>
        {value}
      </div>

      {/* Subtitle (opcional) */}
      {subtitle && (
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: colors.text + 'CC',
          fontWeight: '500'
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
