import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isAndroidApp } from '../utils';

export interface CameraCaptureResult {
  dataUrl: string;
  format?: string;
  source: 'native' | 'web';
}

export class CameraService {
  /**
   * بررسی و درخواست مجوز دوربین (سازگار با اندروید نیتیو و مرورگر)
   */
  static async requestCameraPermission(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const check = await Camera.checkPermissions();
        if (check.camera === 'granted') {
          return true;
        }
        const requested = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
        return requested.camera === 'granted';
      }

      // در محیط وب
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      }
      return true;
    } catch (error) {
      console.warn('عدم امکان اخذ مستقیم مجوز دوربین:', error);
      return false;
    }
  }

  /**
   * عکس‌برداری مستقیم با دوربین دستگاه (چک، فیش حواله، رسید و کالا)
   */
  static async capturePhoto(options?: { quality?: number }): Promise<string | null> {
    const quality = options?.quality || 85;

    // ۱. بررسی پلتفرم نیتیو اندروید / خازنی
    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        const permissionGranted = await this.requestCameraPermission();
        if (!permissionGranted) {
          throw new Error('مجوز دسترسی به دوربین صادر نشد. لطفاً در تنظیمات گوشی دسترسی دوربین را فعال فرمایید.');
        }

        const photo = await Camera.getPhoto({
          quality,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          promptLabelHeader: 'ثبت تصویر با دوربین',
          promptLabelCancel: 'انصراف',
          promptLabelPhoto: 'انتخاب از گالری',
          promptLabelPicture: 'عکس با دوربین'
        });

        if (photo && photo.dataUrl) {
          return photo.dataUrl;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('User cancelled')) {
          return null;
        }
        console.warn('Native camera capture failed, falling back to web file input:', err);
      }
    }

    // ۲. فال‌بک وب: ایجاد فیلد فایل با capture=environment برای فعال‌سازی دوربین در وب‌ویو یا مرورگر موبایل
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';

      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) {
          resolve(null);
          cleanup();
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
          cleanup();
        };
        reader.onerror = () => {
          resolve(null);
          cleanup();
        };
        reader.readAsDataURL(file);
      };

      const cleanup = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      };

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * انتخاب عکس از گالری دستگاه
   */
  static async pickPhotoFromGallery(options?: { quality?: number }): Promise<string | null> {
    const quality = options?.quality || 85;

    if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
      try {
        const photo = await Camera.getPhoto({
          quality,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          promptLabelHeader: 'انتخاب تصویر'
        });

        if (photo && photo.dataUrl) {
          return photo.dataUrl;
        }
      } catch (err: any) {
        if (err.message && err.message.includes('User cancelled')) {
          return null;
        }
      }
    }

    // وب فال‌بک
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.position = 'fixed';
      input.style.opacity = '0';

      input.onchange = (e: any) => {
        const file = e.target?.files?.[0];
        if (!file) {
          resolve(null);
          cleanup();
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
          cleanup();
        };
        reader.readAsDataURL(file);
      };

      const cleanup = () => {
        if (document.body.contains(input)) {
          document.body.removeChild(input);
        }
      };

      document.body.appendChild(input);
      input.click();
    });
  }
}
