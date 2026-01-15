// import bcrypt from 'bcrypt';
// import { supabase } from './src/config/supabase.js';

// async function crearAdmin(usuario, password) {
//   // 1. Encriptamos la contraseña 🔐
//   const saltRounds = 10;
//   const hash = await bcrypt.hash(password, saltRounds);

//   // 2. Lo guardamos en Supabase 📤
//   const { data, error } = await supabase
//     .from('admin_users')
//     .insert([
//       { username: usuario, password_hash: hash }
//     ]);

//   if (error) {
//     console.error('❌ Error al crear admin:', error.message);
//   } else {
//     console.log(`✅ ¡Admin "${usuario}" creado con éxito!`);
//   }
// }

