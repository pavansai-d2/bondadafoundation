const generateApplicationNumber = () => {

    const year = new Date().getFullYear();

    const timestamp = Date.now();

    const randomNumber = Math.floor(
        1000 + Math.random() * 9000
    );

    return `BF-${year}-${timestamp}-${randomNumber}`;
};

export { generateApplicationNumber };