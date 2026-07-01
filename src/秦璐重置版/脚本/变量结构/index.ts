import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../schema';

$(() => {
  console.info('[秦璐重置版] 注册 MVU Schema');
  registerMvuSchema(Schema);
  console.info('[秦璐重置版] MVU Schema 注册完成');
});
