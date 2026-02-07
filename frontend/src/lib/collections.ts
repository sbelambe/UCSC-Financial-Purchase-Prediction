import { collection, DocumentData, CollectionReference } from 'firebase/firestore';
import { db } from './firebase';

export interface UserData {
  email: string;
  department: string;
  role: 'admin' | 'staff';
}

export interface TransactionData {
  amount: number;
  vendor: string;
  date: any; // Firestore Timestamp
}

const createCollection = <T = DocumentData>(collectionName: string) => {
  return collection(db, collectionName) as CollectionReference<T>;
};

export const usersCollection = createCollection<UserData>('users');
export const transactionsCollection = createCollection<TransactionData>('transactions');