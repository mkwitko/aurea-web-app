import { nanoid } from 'nanoid';
import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { Repeater } from '@/components/form/Repeater';
import { ProductCard } from './ProductCard';
import { EMPTY_PRODUCT, type BusinessContextData, type Product } from '@/types/business-context';

interface ProductsStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function ProductsStep({ data, onChange, errors }: ProductsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">{t('wizard.products.intro')}</div>

      <Repeater<Product>
        items={data.products}
        onChange={(products) => onChange({ products })}
        newItem={() => ({ id: nanoid(), ...EMPTY_PRODUCT })}
        itemLabel={(index) => t('wizard.products.productN', { n: index + 1 })}
        addLabel={t('wizard.products.addAnother')}
        removeLabel={t('wizard.products.remove')}
        emptyLabel={t('wizard.products.empty')}
        renderItem={(product, update, index) => (
          <ProductCard product={product} update={update} index={index} errors={errors?.products?.[index]} />
        )}
      />

      {(data.products?.length ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          <Trans i18nKey="wizard.products.tip" components={{ strong: <strong /> }} />
        </p>
      )}
    </div>
  );
}
