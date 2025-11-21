import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository, User, CreateUserDto } from './repository';
import { Logger } from './logger';

const JWT_SECRET = process.env.JWT_SECRET || 'careforall-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'DONOR';
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password_hash'>;
  token: string;
}

export class UserService {
  constructor(
    private repository: UserRepository,
    private logger: Logger
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    this.logger.info({ email: dto.email }, 'Registering new user');

    // Check if user exists
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const password_hash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.repository.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      role: dto.role,
    });

    // Generate token
    const token = this.generateToken(user);

    this.logger.info({ userId: user.id }, 'User registered successfully');

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    this.logger.info({ email: dto.email }, 'User login attempt');

    // Find user
    const user = await this.repository.findByEmail(dto.email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    // Generate token
    const token = this.generateToken(user);

    this.logger.info({ userId: user.id }, 'User logged in successfully');

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async getById(id: string): Promise<Omit<User, 'password_hash'> | null> {
    const user = await this.repository.findById(id);
    return user ? this.sanitizeUser(user) : null;
  }

  async getAll(): Promise<Omit<User, 'password_hash'>[]> {
    const users = await this.repository.findAll();
    return users.map(u => this.sanitizeUser(u));
  }

  async update(id: string, updates: { name?: string; role?: 'ADMIN' | 'DONOR' }): Promise<Omit<User, 'password_hash'> | null> {
    const user = await this.repository.update(id, updates);
    return user ? this.sanitizeUser(user) : null;
  }

  async delete(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string; role: string } | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
      return decoded;
    } catch {
      return null;
    }
  }

  private generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  private sanitizeUser(user: User): Omit<User, 'password_hash'> {
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }
}
