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
}) => (
  `
<!doctype html>
<html>
<head style="margin: 0;padding: 0;">

    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" style="margin: 0;padding: 0;">
    <link href="https://fonts.googleapis.com/css?family=Muli" rel="stylesheet">
</head>

<body bgcolor="#eaeaea" style="margin: 0;padding: 0;-webkit-font-smoothing: antialiased;
-webkit-text-size-adjust: none;height: 100%;width: 100%!important; 
background-color: #eaeaea;font-family: 'Muli', sans-serif;">
    <table class="head-wrap" style="margin: 0;padding: 0;width: 100%;    border-collapse: collapse;">
        <tr style="margin: 0;padding: 0;">
            <td style="margin: 0;padding: 0;"></td>
            <td class="header container" bgcolor="#ffffff" style="margin: 0 auto!important;padding: 0;
            display: block!important;max-width: 700px!important;clear: both!important;margin-top: 50px;">

                <div class="content" style="margin: 0 auto;padding: 0;max-width: 700px;display: block;">
                    <table style="margin: 0;padding: 0;width: 100%;">
                        <tr style="margin: 0;padding: 0;">
                            <td align="center" style="margin: 0;padding: 0;"><a href="#">
                            <img src="https://s3.eu-west-1.
                            amazonaws.com/storage.lodgly.dev-eu-west-1/bucketFolder/1595937581175-lg.jpg"
                            style="margin: 10px 10px; width: 50px;"></a></td>
                        </tr>
                    </table>
                </div>
            </td>
            <td style="margin: 0;padding: 0;"></td>
        </tr>
    </table>
   
    <table class="body-wrap" style="margin: 0;padding: 0;width: 100%;    border-collapse: collapse;">
        <tr style="margin: 0;padding: 0;">
            <td style="margin: 0;padding: 0;"></td>
            <td class="container" bgcolor="#ffffff" style="margin: 0 auto!important;
            padding: 0;display: block!important;max-width: 700px!important;clear: both!important;">



                <div class="content" style="margin: 0 auto;padding: 0px 40px; padding-top: 30px; 
                max-width: 700px;display: block;">
                    <table style="width: 100%;color: #666">
                        <tr>
                            <td>
                                <span style="color: #f9b32b; font-size: 20px;">${`${propertyName}`}</span>
                            </td> 
                            <td align="right">
                            ${`${phone || ''}`}
                            </td>                     
                        </tr> 

                        <tr>
                            <td></td>  
                            <td align="right">
                            ${`${userEmail}`}
                            </td>                       
                        </tr>  
                        
                        <tr>
                            <td>
                            ${`${propertyAddress}`}
                            </td> 
                            <td align="right">
                            ${`${website}`}
                            </td>                     
                        </tr> 

                    </table>
                </div>





                <div class="content" style="margin: 0 auto;padding: 0px 40px; 
                padding-top: 40px; max-width: 700px;display: block; ">
                    <table style="width: 100%;color: #666; border-bottom: 1px solid #333;">
                        <tr>
                            <td>
                                <span style="color: #333; font-size: 20px; font-weight: 600">${`${label}`}</span>
                            </td> 
                            <td align="right">
                               <span style="color: #333; font-size: 20px; font-weight: 600">CLIENT</span>
                            </td>                     
                        </tr> 

                    </table>
                </div>


                <div class="content" style="margin: 0 auto;padding: 0px 20px; padding-top: 15px; 
                max-width: 700px;display: block;">
                    <table style="width: 100%;color: #666">
                        <tr>
                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">DATE/TIME</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">
                               ${`${date}`} /${`${time}`}
                               </span>
                            </td>

                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">FULL NAME</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${clientName}`}</span>
                            </td>                        
                        </tr> 


                         <tr>
                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">DELIVERY DATE</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${deliveryDate}`}</span>
                            </td>

                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">EMAIL</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${email}`}</span>
                            </td>                        
                        </tr> 


                        <tr>
                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">DUE DATE</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${dueDate}`}</span>
                            </td>

                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">ADDRESS</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; 
                               font-weight: 600">${`${address}`}</span>
                            </td>                        
                        </tr> 


                        <tr>
                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">PAYMENT TYPE</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${paymentType}`}</span>
                            </td>

                            <td style="padding: 5px 20px;">
                                <span style="color: #999; font-size: 12px; font-weight: 600">VAT ID</span>
                            </td> 
                            <td align="right" style="padding: 5px 20px;">
                               <span style="color: #333; font-size: 12px; font-weight: 600">${`${vat}`}</span>
                            </td>                        
                        </tr> 

                    </table>
                </div>



                 <div class="content" style="margin: 0 auto;padding: 0px 40px; 
                 padding-top: 60px; max-width: 700px;display: block; ">
                    <table style="width: 100%;color: #666;border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="padding:5px; color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">ITEM DESCRIPTION</th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">QTY</th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">PRICE</th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">AMOUNT</th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;"></th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">DISCOUNT</th>
                                <th style="padding:5px;color: #999; font-size: 13px; text-align: left;
                                border-bottom: 1px solid #999;">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            
                        ${`${itemData.map((el) => {
    console.log('hi');
    return `
                            <tr>
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemDescription}`}</span>
                            </td>                     
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemQuantity}`}</span>
                            </td>     
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemPrice}`} EUR</span>
                            </td>     
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemAmount}`} EUR</span>
                            </td>     
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemDiscountPer}`}
                                ${`${el.itemDiscountType}`}</span>
                            </td>  
                             
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemDiscount}`} EUR</span>
                            </td>     
                            <td style="padding:5px;">
                               <span style="color: #333; font-size: 13px;">${`${el.itemTotal}`} EUR</span>
                            </td>     
                        </tr> 
                        `;
  })}`}
                        
                        </tbody>
                    </table>
                </div>


                <div class="content" style="margin: 0 auto;padding: 0px 40px; 
                padding-top: 30px; max-width: 700px;display: block; ">
                    <table style="width: 100%;color: #666;">
                        <tr>
                            <td align="right">
                         <span style="color: #333; font-size: 24px; font-weight: 600">Total: ${`${total}`} EURO</span>
                            </td>                     
                        </tr> 

                    </table>
                </div>







            </td>
            <td style="margin: 0;padding: 0;"></td>
        </tr>
    </table>
    <!-- /BODY -->





    <table class="head-wrap" style="margin: 0;padding: 0;width: 100%;    border-collapse: collapse;">
        <tr style="margin: 0;padding: 0;">
            <td style="margin: 0;padding: 0;"></td>
            <td class="header container" bgcolor="#ffffff" style="margin: 0 auto!important;
            padding: 0;display: block!important;max-width: 700px!important;clear: both!important;margin-top: 50px;">

                <div class="content" style="margin: 0 auto;padding: 40px 40px;max-width: 700px;display: block;">
                    <table style="margin: 0;padding: 0;width: 100%;">
                        <tr style="margin: 0;padding: 0;">
                            <td align="left" style="margin: 0;padding: 0;">

                                <p style="margin-bottom: 10px; margin-top: 0px; font-size: 14px; 
                                line-height: 1.5; color:#999;">IMPRESSION</p> 
                                
                                <p style="margin-bottom: 30px; margin-top: 0px; 
                                font-size: 14px; line-height: 1.5; color:#666;">
                               ${`${impression}`}</p> 


                            <p style="color: #999; font-size:12px;max-width: 335px;
                             margin: 0px auto;text-align: center;">${`${propertyAddress}`} | ${`${phone}`}
                                | ${`${email}`} | ${`${website}`}  </p>
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
`
);
