import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../schema';

// 立即初始化 fusion_hint 变量，确保世界书读取时不会报错
updateVariablesWith(vars => {
  if (!_.has(vars, 'fusion_hint')) {
    _.set(vars, 'fusion_hint', '');
  }
  return vars;
}, { type: 'global' });

$(() => {
  console.info('[秦璐] 注册 MVU Schema');
  registerMvuSchema(Schema);
  console.info('[秦璐] MVU Schema 注册完成');
});
