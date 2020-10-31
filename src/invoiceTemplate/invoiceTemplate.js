module.exports = ({
  label,
  date,
  time,
  deliveryDate,
  dueDate,
  paymentType,
  clientName,
  email,
  userEmail,
  address,
  vat,
  itemData,
  propertyName,
  website,
  propertyAddress,
  phone,
  total,
  impression,
  logo,
  currency,
}) => `
<!doctype html>
<html>

<head>


</head>

<body bgcolor="white" style="margin: 0;padding: 0;height: 100%;width: 100%!important;
background-color: white;font-family: 'Muli', sans-serif;">
<table class="head-wrap" style="margin: 0;padding: 0;width: 100%; border-collapse: collapse;">
<tr style="margin: 0;padding: 0;">
<td style="margin: 0;padding: 0;"></td>
<td class="header container" bgcolor="#ffffff" style="margin: 0 auto!important;padding: 0;
display: block!important;max-width: 700px!important;clear: both!important;margin-top: 50px;">

<div class="content" style="margin: 0 auto;padding: 0;max-width: 100%;display: block;">
<table style="margin: 0;padding: 0;width: 100%;">
<tr style="margin: 0;padding: 0;">
<td align="center" style="margin: 0;padding: 0;"><a href="#">
<img src=${`${logo}`} style="margin: 10px 10px; width: 50px;"></a></td>
</tr>
</table>
</div>
</td>
<td style="margin: 0;padding: 0;"></td>
</tr>
</table>

<table class="body-wrap" style="margin: 0;padding: 0;width: 100%; border-collapse: collapse;">
<tr style="margin: 0;padding: 0;">
<td style="margin: 0;padding: 0;"></td>
<td class="container" bgcolor="#ffffff" style="margin: 0 auto!important;
padding: 0;display: block!important;max-width: 700px!important;clear: both!important;">



<div class="content" style="margin: 0 auto;padding: 0px 40px; padding-top: 30px;
max-width: 700px;display: block;">
<table style="width: 100%;color: #666">
<tr>
<td>
<span style="color: #FAB52C; font-size: 12px;">
${`${propertyName}`}</span>
</td>
<td align="right" style="font-size: 9px;color: rgba(62, 63, 66, 0.5);">
${`${phone || 'N/A'}`}
</td>
</tr>

<tr>
<td style="font-size: 9px;color: rgba(62, 63, 66, 0.5);"></td>
<td align="right" style="font-size:9px;color: rgba(62, 63, 66, 0.5);">
${`${userEmail || 'N/A'}`}
</td>
</tr>

<tr>
<td style="font-size: 9px;color: rgba(62, 63, 66, 0.5);">
${`${propertyAddress || 'N/A'}`}
</td>
<td align="right" style="font-size: 9px;color: rgba(62, 63, 66, 0.5);">
${`${website || 'N/A'}`}
</td>
</tr>

</table>
</div>





<div class="content" style="margin: 0 auto;padding: 0px 40px;
padding-top: 20px; max-width: 700px;display: block; ">
<table style="width: 100%;color: #666; border-bottom: 1px solid #333;">
<tr>
<td>
<span style="color: #3E3F42; font-size: 10px;font-weight: 500">
${`${label}`}</span>
</td>
<td align="right">
<span style="color: #3E3F42; font-size: 10px;font-weight: 500">
CLIENT</span>
</td>
</tr>

</table>
</div>


<div class=" content" style="margin: 0 auto;padding: 0px 20px; padding-top: 10px;
max-width: 700px;display: block;">
<table style="width: 100%;color: #666">
<tr>
<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);font-size: 9px;">
DATE/TIME</span>
</td>
<td align="right" style="padding: 0px 10px;">
<span style="color: #3E3F42;font-size: 9px;">
${`${date || 'N/A'}`} /${`${time || 'N/A'}`}
</span>
</td>

<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);
font-size: 9px;">FULL
NAME</span>
</td>
<td align="right" style="padding: 0px 9px;">
<span style="color: #3E3F42;font-size: 9px;">${`${clientName}`}</span>
</td>
</tr>


<tr>
<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);
font-size: 9px;">DELIVERY
DATE</span>
</td>
<td align="right" style="padding: 0px 10px;">
<span style="color: #3E3F42;font-size: 9px;">${`${deliveryDate}`}</span>
</td>

<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);
font-size: 9px;">EMAIL</span>
</td>
<td align="right" style="padding: 0px 9px;">
<span style="color: #3E3F42;font-size: 10px;">${`${email}`}</span>
</td>
</tr>


<tr>
<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);
font-size: 9px;">
DATE
</span>
</td>
<td align="right" style="padding: 0px 10px;">
<span style="color: #3E3F42;font-size: 9px;">${`${dueDate}`}</span>
</td>

<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);font-size: 9px;">
ADDRESS</span>
</td>
<td align="right" style="padding: 0px 10px;">
<span style="color: #3E3F42;font-size: 9px;">${`${address || 'N/A'}`}</span>
</td>
</tr>


<tr>
<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);font-size: 9px;">PAYMENT
TYPE</span>
</td>
<td align="right" style="padding: 0px 9px;">
<span style="color: #3E3F42;font-size: 10px;">${`${paymentType || 'N/A'}`}</span>
</td>

<td style="padding: 0px 10px;">
<span style="color: rgba(62, 63, 66, 0.5);font-size: 9px;">VAT
ID</span>
</td>
<td align="right" style="padding: 0px 10px;">
<span style="color: #3E3F42;font-size: 9px;">
${`${vat || 'N/A'}`}</span>
</td>
</tr>

</table>
</div>



<div class="content" style="margin: 0 auto;padding: 0px 40px;
padding-top: 60px; max-width: 700px;display: block; ">
<table style="width: 100%;color: #666;border-collapse: collapse;">
<thead>
<tr>
<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size: 9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">ITEM DESCRIPTION</th>
<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size: 9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">QTY</th>
<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size: 9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">PRICE</th>
<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size:9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">AMOUNT</th>

<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size: 9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">DISCOUNT</th>
<th style="padding:0px 5px; color: rgba(62, 63, 66, 0.5);
font-size: 9px;text-align: left;
border-bottom: 1px solid rgba(62, 63, 66, 0.5);font-weight: 100;">TOTAL</th>
</tr>
</thead>
<tbody>

${itemData.map((el) => {
    console.log('i');
    return `
<tr>
<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemDescription}`}</span>
</td>
<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemQuantity}`}</span>
</td>
<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemPrice}`} ${`${currency}`}</span>
</td>
<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemAmount}`} ${`${currency}`}</span>
</td>


<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemDiscount}`} ${`${currency}`}</span>
</td>
<td style="padding:0px 5px;">
<span style="color: #3E3F42; font-size: 9px;">
${`${el.itemTotal}`} ${`${currency}`}</span>
</td>
</tr>
`;
  })}

</tbody>
</table>
</div>
<div class="content" style="margin: 0 auto;padding: 0px 40px;
padding-top: 30px; max-width: 700px;display: block; ">
<table style="width: 100%;color: #666;">
<tr>
<td align="right">
<span style="color: #3E3F42; font-size: 14px; font-weight: 600">
Total: ${`${total}`}
${`${currency}`}</span>
</td>
</tr>

</table>
</div>
</td>
<td style="margin: 0;padding: 0;"></td>
</tr>
</table>
<!-- /BODY -->





<table class="head-wrap" style="margin: 0;padding: 0;width: 100%; border-collapse: collapse;">
<tr style="margin: 0;padding: 0;">
<td style="margin: 0;padding: 0;"></td>
<td class="header container" bgcolor="#ffffff" style="margin: 0 auto!important;
padding: 0;display: block!important;max-width: 700px!important;clear: both!important;margin-top: 50px;">

<div class="content" style="margin: 0 auto;padding: 80px 40px;max-width: 700px;display: block;">
<table style="margin: 0;padding: 0;width: 100%;">
<tr style="margin: 0;padding: 0;">
<td align="left" style="margin: 0;padding: 0;">

<p style="margin-bottom: 5px; margin-top: 0px; font-size: 10px;color: rgba(62, 63, 66, 0.5);">IMPRESSION</p>


<p style="margin-bottom: 10px; margin-top: 0px;
font-size: 10px;color: #3E3F42;">
${`${impression}`}</p>


<p style="color: rgba(62, 63, 66, 0.5);
font-size:8px;max-width: 335px;
margin: 0px auto;text-align: center;">
${`${propertyAddress || 'N/A'}`} | ${`${phone || 'N/A'}`}
| ${`${email || 'N/A'}`} | ${`${website || 'N/A'}`} </p>
</td>
</tr>
</table>
</div>
</td>
<td style="margin: 0;padding: 0;"></td>
</tr>
</table>

</body>

</html>
    `;
