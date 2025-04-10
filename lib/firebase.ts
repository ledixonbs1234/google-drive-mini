import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, StorageReference } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCyOiqe8jyNx7L9usaTGZlopGSOyYL5Gn8",
  authDomain: "buudien-f1669.firebaseapp.com",
  databaseURL: "https://buudien-f1669-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "buudien-f1669",
  storageBucket: "buudien-f1669.appspot.com",
  messagingSenderId: "514830976899",
  appId: "1:514830976899:web:c8d48ea280e9eb5ff058b6",
  measurementId: "G-JRFLEJ8P9P"
};


// Khởi tạo Firebase App
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const storage = getStorage(app);

// Hàm tạo thư mục (bằng cách tạo file .keep ẩn)
const createFolder = async (folderPath: string): Promise<void> => {
  // Đảm bảo folderPath kết thúc bằng dấu /
  const path = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
  // Tạo file trống .keep để đánh dấu thư mục tồn tại
  const keepFileRef = ref(storage, `${path}.keep`);
  try {
    // Upload một Blob trống
    await uploadBytes(keepFileRef, new Blob([]));
    console.log(`Thư mục ${path} đã được tạo.`);
  } catch (error) {
    console.error("Lỗi khi tạo thư mục:", error);
    // Có thể thư mục đã tồn tại hoặc lỗi mạng
    // Trong trường hợp này, ta có thể bỏ qua lỗi nếu file đã tồn tại
    if ((error as any).code !== 'storage/object-not-found') {
         // Ném lại lỗi nếu không phải lỗi 'object-not-found' (có thể xử lý cụ thể hơn)
         // Hoặc nếu file .keep đã có sẵn thì coi như thành công
    }
     // Nếu lỗi là do file .keep đã tồn tại, ta coi như tạo thư mục thành công
     if ((error as any).code === 'storage/invalid-argument') {
        // Firebase Storage có thể trả về lỗi này nếu bạn cố tạo file .keep khi thư mục đã có file khác
        // Vẫn xem như thành công vì thư mục đã tồn tại
        console.log(`Thư mục ${path} dường như đã tồn tại.`);
     } else if ((error as any).code !== 'storage/object-not-found') {
        throw error; // Ném lại các lỗi khác
     }
  }
};


export { storage, createFolder };