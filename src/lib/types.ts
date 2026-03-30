export type UserRole = 'superadmin' | 'center_leader' | 'trainer';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  centerId?: string;
  centerName?: string;
  isBlocked?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Center {
  id: string;
  name: string;
  centerNumber: number;
  location?: string;
  image?: string;
  leaderId?: string;
  leaderName?: string;
  leaderEmail?: string;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type MedicRole = 'medic' | 'driver' | 'trainer';
export type MedicStatus = 'active' | 'inactive';

export interface Medic {
  id: string;
  centerId: string;
  centerName: string;
  name: string;
  phone: string;
  role: MedicRole;
  status: MedicStatus;
  birthDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type OperationType = 'EMS' | 'RESCUE' | 'FIRE';
export type OperationStatus = 'pending' | 'completed' | 'cancelled';

export interface Operation {
  id: string;
  caseId: string;
  centerId: string;
  centerName: string;
  approvalNumber: string;
  type: OperationType;
  caseName: string;
  date: string;
  time: string;
  location?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  members: string[];
  memberNames?: string[];
  report: string;
  images: string[];
  status?: OperationStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface Schedule {
  id: string;
  centerId: string;
  dayOfWeek: string;
  timeFrom: string;
  timeTo: string;
  assignedMedics: string[];
  assignedMedicNames?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TrainingFile {
  id: string;
  trainerId: string;
  trainerName: string;
  title: string;
  description?: string;
  sessionsCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface TrainingSession {
  id: string;
  trainingFileId: string;
  trainerId: string;
  trainerName: string;
  centerName: string;
  title: string;
  date: string;
  report: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MonthlyReport {
  month: string;
  year: number;
  totalOperations: number;
  emsCount: number;
  rescueCount: number;
  centerStats: {
    centerId: string;
    centerName: string;
    total: number;
    ems: number;
    rescue: number;
  }[];
}

export interface YearlyReport {
  year: number;
  totalOperations: number;
  centerComparison: {
    centerId: string;
    centerName: string;
    total: number;
  }[];
  mostActiveCenter: string;
}

// ─── Events (أحداث) ──────────────────────────────────────────────────────────

export type CenterDamageLevel = 'total' | 'partial' | 'cracks';
export type AttackType = 'direct' | 'nearby';

export interface CenterDamageEvent {
  id: string;
  centerId: string;
  centerName: string;
  damageLevel: CenterDamageLevel;
  estimatedCost: string;
  attackDate: string;
  attackType: AttackType;
  images: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type VehicleDamageSize = 'big' | 'small';
export type MaintenanceType = 'direct' | 'difficult';
export type VehicleFieldStatus = 'out_of_service' | 'in_service';

export interface VehicleDamageEvent {
  id: string;
  centerId: string;
  centerName: string;
  vehicleNumber: string;
  vehicleTypeModel: string;
  incidentDate: string;
  resultingDefects: string;
  damageSize: VehicleDamageSize;
  estimatedCost: string;
  maintenanceType: MaintenanceType;
  fieldStatus: VehicleFieldStatus;
  images: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type InjurySeverity = 'serious' | 'moderate' | 'minor';
export type FollowUpType = 'medical' | 'surgical' | 'pharmaceutical';

export interface InjuredMedicEvent {
  id: string;
  centerId: string;
  centerName: string;
  fullName: string;
  birthDate: string;
  mission: string;
  injuryDate: string;
  injuryType: string;
  injuryLocation: string;
  severity: InjurySeverity;
  hospitalName: string;
  followUpType: FollowUpType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface MartyrMedicEvent {
  id: string;
  centerId: string;
  centerName: string;
  fullName: string;
  mission: string;
  birthDate: string;
  familyStatus: string;
  martyrdomDate: string;
  martyrdomPlace: string;
  hospitalName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Deployment (الانتشار) ──────────────────────────────────────────────────

export interface Deployment {
  id: string;
  centerId: string;
  centerName: string;
  teamMembers: string[];
  location: string;
  date: string;
  vehicleInfo: string;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

// ─── Center Info (معلومات المركز) ───────────────────────────────────────────

export interface CenterInfo {
  id: string;
  centerId: string;
  centerName: string;
  townName: string;
  squadLeaderName: string;
  squadLeaderPhone: string;
  ambulanceCount: number;
  ambulanceNumbers: string[];
  hasFireDepartment: boolean;
  fireManagerName?: string;
  fireManagerPhone?: string;
  fireVehicleCount?: number;
  fireVehicleNumbers?: string[];
  hasRescueDepartment: boolean;
  rescueManagerName?: string;
  rescueManagerPhone?: string;
  rescueVehicleCount?: number;
  rescueVehicleNumbers?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Audit Log (سجل المراقبة) ───────────────────────────────────────────────

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'block' | 'unblock';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  centerId?: string;
  centerName?: string;
  action: AuditAction;
  collection: string;
  documentId?: string;
  details: string;
  ip?: string;
  timestamp: string;
}

// ─── Login Session (جلسة تسجيل الدخول) ──────────────────────────────────────

export interface LoginSession {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  centerId?: string;
  centerName?: string;
  ip: string;
  userAgent: string;
  deviceType: string;
  browser: string;
  os: string;
  loginAt: string;
  lastActiveAt: string;
  isActive: boolean;
}
