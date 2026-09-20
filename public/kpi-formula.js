// Declarative formulas only. Shared by browser, PocketBase validation and tests.
(function(root) {
  const fields = {
    va_outcome:{label:'ผล VA 1 เดือน',values:['pass','fail']}, biometry:{label:'ผล Biometry',values:['pass','fail']}, refractive:{label:'ผล Refractive',values:['pass','fail']},
    endophthalmitis:{label:'Endophthalmitis',values:['yes','no']}, wound_leak:{label:'Wound leak',values:['yes','no']}, reoperation:{label:'Re-operation',values:['yes','no']},
    eye:{label:'ข้างที่ผ่าตัด',values:['OD','OS','OU']},
    day1_va:{label:'VA Day 1',presence:true}, week1_va:{label:'VA 1 สัปดาห์',presence:true}, month1_va:{label:'VA 1 เดือน',presence:true},
    pain_score:{label:'Pain score',numeric:true}
  };
  const operators = {eq:'เท่ากับ',ne:'ไม่เท่ากับ',gt:'มากกว่า',gte:'มากกว่าหรือเท่ากับ',lt:'น้อยกว่า',lte:'น้อยกว่าหรือเท่ากับ',is_set:'มีข้อมูล',is_empty:'ไม่มีข้อมูล'};
  const own = (object,key)=>Object.prototype.hasOwnProperty.call(object,key);
  const plain = value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const exactKeys = (value, keys)=>plain(value)&&Object.keys(value).length===keys.length&&keys.every(k=>own(value,k));
  function allowed(field) { return fields[field]?.numeric?Object.keys(operators):fields[field]?.presence?['is_set','is_empty']:['eq','ne','is_set','is_empty']; }
  function validate(formula) {
    if (!plain(formula)||!['ratio','average'].includes(formula.mode)) return 'เลือกสูตรร้อยละหรือค่าเฉลี่ย Pain score';
    if (!exactKeys(formula,formula.mode==='ratio'?['mode','numerator','denominator']:['mode','denominator'])) return 'โครงสร้างสูตรไม่ถูกต้อง';
    for (const rule of [formula.denominator,...(formula.mode==='ratio'?[formula.numerator]:[])]) {
      if (!exactKeys(rule,['match','conditions'])||!['all','any'].includes(rule.match)||!Array.isArray(rule.conditions)||rule.conditions.length>10) return 'แต่ละกลุ่มใช้ได้ไม่เกิน 10 เงื่อนไข และต้องเลือกครบทุกข้อหรือข้อใดข้อหนึ่ง';
      for (const condition of rule.conditions) {
        if (!plain(condition)||!own(fields,condition.field)||!allowed(condition.field).includes(condition.operator)) return 'ฟิลด์หรือตัวเปรียบเทียบไม่รองรับ';
        const presence=['is_set','is_empty'].includes(condition.operator);
        if (!exactKeys(condition,presence?['field','operator']:['field','operator','value'])) return 'โครงสร้างเงื่อนไขไม่ถูกต้อง';
        if (!presence) {
          if (fields[condition.field].numeric) { if(typeof condition.value!=='number'||!Number.isFinite(condition.value)||condition.value<0||condition.value>10) return 'ค่า Pain score ต้องเป็นตัวเลข 0–10'; }
          else if (!fields[condition.field].values.includes(condition.value)) return 'ค่าเปรียบเทียบไม่อยู่ในรายการที่รองรับ';
        }
      }
    }
    return '';
  }
  function matches(record, rule) {
    if (!rule.conditions.length) return true;
    const results=rule.conditions.map(c=>{
      const raw=record[c.field], present=raw!==''&&raw!==null&&raw!==undefined;
      if(c.operator==='is_set')return present;
      if(c.operator==='is_empty')return !present;
      // Missing is unknown, including for "not equal"; zero is a recorded value.
      if(!present)return false;
      const value=fields[c.field].numeric?Number(raw):raw;
      if(fields[c.field].numeric&&!Number.isFinite(value))return false;
      switch(c.operator){case 'eq':return value===c.value;case 'ne':return value!==c.value;case 'gt':return value>c.value;case 'gte':return value>=c.value;case 'lt':return value<c.value;case 'lte':return value<=c.value;default:return false;}
    });
    return rule.match==='all'?results.every(Boolean):results.some(Boolean);
  }
  function calculate(cases, formula) {
    const error=validate(formula);
    if(error)return {value:null,numerator:0,denominator:0,missing:cases.filter(c=>!c.archived).length,unit:'%',error};
    const live=cases.filter(c=>!c.archived), eligible=live.filter(c=>matches(c,formula.denominator));
    const average=formula.mode==='average';
    const assessed=average?eligible.filter(c=>c.pain_score!==''&&c.pain_score!==null&&c.pain_score!==undefined&&Number.isFinite(Number(c.pain_score))&&Number(c.pain_score)>=0&&Number(c.pain_score)<=10):eligible;
    const denominator=assessed.length;
    // Numerator must be a subset of the denominator population.
    const numerator=average?assessed.reduce((sum,c)=>sum+Number(c.pain_score),0):assessed.filter(c=>matches(c,formula.numerator)).length;
    return {value:denominator?numerator/denominator*(average?1:100):null,numerator,denominator,missing:live.length-denominator,unit:average?'คะแนน':'%'};
  }
  function describeRule(rule) {
    if (!rule.conditions.length) return 'ทุกเคส';
    const values={pass:'ผ่าน',fail:'ไม่ผ่าน',yes:'พบ',no:'ไม่พบ'};
    return rule.conditions.map(c=>`${fields[c.field].label} ${operators[c.operator]}${own(c,'value')?' '+(values[c.value]||c.value):''}`).join(rule.match==='all'?' และ ':' หรือ ');
  }
  function describe(formula) {
    const error=validate(formula);if(error)return error;
    return formula.mode==='average'?`ผลรวม Pain score ÷ จำนวนเคสที่มี Pain score · เงื่อนไข: ${describeRule(formula.denominator)}`:`จำนวนเคสในตัวหารที่ (${describeRule(formula.numerator)}) ÷ จำนวนเคสที่ (${describeRule(formula.denominator)}) × 100`;
  }
  const api={fields,operators,allowed,validate,calculate,describe};
  if(typeof module!=='undefined')module.exports=api;else root.KpiFormula=api;
})(typeof window==='undefined'?globalThis:window);
