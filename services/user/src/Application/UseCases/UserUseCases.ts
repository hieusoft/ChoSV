import type { IProfileRepository, UpdateProfileFields } from '../Interfaces/IProfileRepository';
import {
  toProfileDto,
  toPublicProfileDto,
  type ProfileDto,
  type PublicProfileDto,
} from '../DTOs/Profile/ProfileResponseDto';
import { ProfileNotFoundException } from '../Exceptions/ProfileException';

export class UserUseCases {
  private readonly _profileRepository: IProfileRepository;

  constructor(profileRepository: IProfileRepository) {
    this._profileRepository = profileRepository;
  }

  async getMeAsync(userId: string): Promise<ProfileDto> {
    const profile = await this._profileRepository.findByUserId(userId);
    if (!profile) {
      throw new ProfileNotFoundException();
    }
    return toProfileDto(profile);
  }

  async updateMeAsync(userId: string, fields: UpdateProfileFields): Promise<ProfileDto> {
    const existing = await this._profileRepository.findByUserId(userId);
    if (!existing) {
      throw new ProfileNotFoundException();
    }
    const updated = await this._profileRepository.update(userId, fields);
    return toProfileDto(updated);
  }

  async getPublicProfileAsync(userId: string): Promise<PublicProfileDto> {
    const profile = await this._profileRepository.findByUserId(userId);
    if (!profile) {
      throw new ProfileNotFoundException();
    }
    return toPublicProfileDto(profile);
  }

  // Gọi bởi consumer khi nhận event user.registered từ auth-service.
  // Idempotent: nếu profile đã tồn tại thì bỏ qua (event có thể redeliver).
  async provisionProfileAsync(userId: string, fullName: string): Promise<void> {
    if (await this._profileRepository.existsByUserId(userId)) {
      return;
    }
    await this._profileRepository.create(userId, fullName);
  }
}
