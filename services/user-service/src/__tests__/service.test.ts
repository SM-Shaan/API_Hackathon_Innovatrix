import { UserService } from '../service';
import { UserRepository } from '../repository';

// Mock the repository
jest.mock('../repository');

describe('UserService', () => {
  let userService: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockLogger: any;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      initialize: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    userService = new UserService(mockRepository, mockLogger);
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockRepository.findByEmail.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        password_hash: 'hashed',
        name: dto.name,
        role: 'DONOR',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await userService.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.token).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      const dto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User',
      };

      mockRepository.findByEmail.mockResolvedValue({
        id: 'existing-user',
        email: dto.email,
        password_hash: 'hashed',
        name: dto.name,
        role: 'DONOR',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(userService.register(dto)).rejects.toThrow(
        'User with this email already exists'
      );
    });
  });

  describe('login', () => {
    it('should throw error for invalid credentials', async () => {
      mockRepository.findByEmail.mockResolvedValue(null);

      await expect(
        userService.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('getById', () => {
    it('should return user without password hash', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        password_hash: 'secret',
        name: 'Test',
        role: 'DONOR',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await userService.getById('user-123');

      expect(result).toBeDefined();
      expect((result as any).password_hash).toBeUndefined();
    });
  });
});
