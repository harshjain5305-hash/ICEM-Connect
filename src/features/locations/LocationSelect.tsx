import React, { useState, useEffect, useRef } from 'react';
import { locationService } from './location.service';
import type { Location } from './location.schema';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { School, Navigation, Bus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LocationSelectProps {
  label: string;
  placeholder?: string;
  value?: string | null;
  onSelect: (location: Location) => void;
  error?: string;
  disabled?: boolean;
}

export const LocationSelect: React.FC<LocationSelectProps> = ({
  label,
  placeholder = 'Search campus or transit point...',
  value,
  onSelect,
  error,
  disabled,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize selected location if value (id) is provided
  useEffect(() => {
    if (value) {
      locationService.getById(value).then((loc) => {
        if (loc) {
          setSelectedLocation(loc);
          setSearchTerm(loc.name);
        }
      });
    } else {
      setSelectedLocation(null);
      setSearchTerm('');
    }
  }, [value]);

  // Debounced search (Design.md §59)
  useEffect(() => {
    if (!isOpen) return;

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const data = await locationService.search({
          query: searchTerm,
          limit: 8,
        });
        setResults(data);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchTerm, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (loc: Location) => {
    setSelectedLocation(loc);
    setSearchTerm(loc.name);
    setIsOpen(false);
    onSelect(loc);
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'ICEM':
        return <School className="h-4 w-4 text-[#00A2A5]" />;
      case 'MAIN_ROAD':
        return <Navigation className="h-4 w-4 text-primary" />;
      case 'BUS_STOP':
        return <Bus className="h-4 w-4 text-amber-600" />;
      default:
        return <Building2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        label={label}
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        error={error}
        disabled={disabled}
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {isLoading ? (
            <div className="p-3 text-center text-xs text-muted-foreground">Searching locations...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground">
              No matching campus locations found.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((loc) => {
                const isSelected = selectedLocation?.id === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left text-xs transition-colors hover:bg-muted/70',
                      isSelected && 'bg-primary/10'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{getLocationIcon(loc.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <span className="truncate">{loc.name}</span>
                        {loc.type === 'ICEM' && (
                          <Badge variant="cyan" className="text-[9px] px-1.5 py-0">
                            Campus
                          </Badge>
                        )}
                      </div>
                      {loc.address && (
                        <p className="truncate text-[11px] text-muted-foreground">{loc.address}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
