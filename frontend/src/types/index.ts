import { Timestamp } from "firebase/firestore";

// general schema for item transaction
export interface Transaction {
    id: string;
    userId: string;
    vendor: string;
    amount: number;
    date: Timestamp;  
    category: string;
    status: 'pending' | 'completed' | 'rejected';
}

// general schema for user properties
export interface UserProfile {
    email: string,
    department: string,
    role: string,
}