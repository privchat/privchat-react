import { createContext } from 'react';
import type { PrivchatClientAdapter } from '../adapter/client-adapter.js';

export const PrivchatContext = createContext<PrivchatClientAdapter | null>(null);
