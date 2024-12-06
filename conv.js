function convert(source) {
    let decimal, binary, octal, hexadecimal;

    try {
        switch (source) {
            case 'decimal':
                decimal = parseInt(document.getElementById('decimal').value, 10);
                if (isNaN(decimal)) throw 'Invalid input';
                binary = decimal.toString(2);
                octal = decimal.toString(8);
                hexadecimal = decimal.toString(16).toUpperCase();
                break;

            case 'binary':
                binary = document.getElementById('binary').value;
                decimal = parseInt(binary, 2);
                if (isNaN(decimal)) throw 'Invalid input';
                octal = decimal.toString(8);
                hexadecimal = decimal.toString(16).toUpperCase();
                break;

            case 'octal':
                octal = document.getElementById('octal').value;
                decimal = parseInt(octal, 8);
                if (isNaN(decimal)) throw 'Invalid input';
                binary = decimal.toString(2);
                hexadecimal = decimal.toString(16).toUpperCase();
                break;

            case 'hexadecimal':
                hexadecimal = document.getElementById('hexadecimal').value;
                decimal = parseInt(hexadecimal, 16);
                if (isNaN(decimal)) throw 'Invalid input';
                binary = decimal.toString(2);
                octal = decimal.toString(8);
                break;
        }

        document.getElementById('decimal').value = decimal || '';
        document.getElementById('binary').value = binary || '';
        document.getElementById('octal').value = octal || '';
        document.getElementById('hexadecimal').value = hexadecimal || '';
    } catch (e) {
        // Clear fields with invalid conversions
        if (source !== 'decimal') document.getElementById('decimal').value = '';
        if (source !== 'binary') document.getElementById('binary').value = '';
        if (source !== 'octal') document.getElementById('octal').value = '';
        if (source !== 'hexadecimal') document.getElementById('hexadecimal').value = '';
    }
}
