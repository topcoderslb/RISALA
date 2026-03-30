import { collection, query, where, getDocs, orderBy, limit, startAfter, DocumentSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from './firebase';

export interface PaginationResult<T> {
  data: T[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export async function getPaginatedData<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  pageSize: number = 20,
  lastDocument?: DocumentSnapshot | null
): Promise<PaginationResult<T>> {
  const queryConstraints: QueryConstraint[] = [...constraints, limit(pageSize + 1)];

  if (lastDocument) {
    queryConstraints.push(startAfter(lastDocument));
  }

  const q = query(collection(db, collectionName), ...queryConstraints);
  const snapshot = await getDocs(q);

  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  const data = docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[];

  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;

  return { data, lastDoc, hasMore };
}

export function buildFilterConstraints(filters: Record<string, unknown>): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      constraints.push(where(key, '==', value));
    }
  });

  return constraints;
}
